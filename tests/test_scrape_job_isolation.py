import asyncio
import json
import uuid

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

import backend.server as server
from backend.db.auth import create_access_token, get_password_hash
from backend.db.database import Base, SessionLocal, engine
from backend.db.models import ScrapeJob, ScrapeJobHistory, User


client = TestClient(server.app)


@pytest.fixture
def users():
    Base.metadata.create_all(bind=engine)
    suffix = uuid.uuid4().hex
    db = SessionLocal()
    user_a = User(
        name="Scrape Isolation A",
        email=f"scrape-a-{suffix}@test.example",
        password_hash=get_password_hash("Password123!"),
        is_active=True,
    )
    user_b = User(
        name="Scrape Isolation B",
        email=f"scrape-b-{suffix}@test.example",
        password_hash=get_password_hash("Password123!"),
        is_active=True,
    )
    db.add_all([user_a, user_b])
    db.commit()
    db.refresh(user_a)
    db.refresh(user_b)
    result = {
        "a_id": user_a.id,
        "b_id": user_b.id,
        "a_headers": {"Authorization": f"Bearer {create_access_token({'sub': str(user_a.id)})}"},
        "b_headers": {"Authorization": f"Bearer {create_access_token({'sub': str(user_b.id)})}"},
    }
    db.close()
    try:
        yield result
    finally:
        with server.runner_lock:
            for job_id, runner in list(server.scrape_runners.items()):
                if runner.user_id in (result["a_id"], result["b_id"]):
                    server.scrape_runners.pop(job_id, None)
        db = SessionLocal()
        db.query(ScrapeJob).filter(ScrapeJob.user_id.in_([result["a_id"], result["b_id"]])).delete(synchronize_session=False)
        db.query(ScrapeJobHistory).filter(ScrapeJobHistory.user_id.in_([result["a_id"], result["b_id"]])).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_([result["a_id"], result["b_id"]])).delete(synchronize_session=False)
        db.commit()
        db.close()


def add_job(user_id, job_id, status="running", status_json=None, excel_file_path=None):
    db = SessionLocal()
    job = ScrapeJob(
        job_id=job_id,
        user_id=user_id,
        status=status,
        status_json=json.dumps(status_json or {"status": status, "job_id": job_id, "records": []}),
        excel_file_path=excel_file_path,
    )
    db.add(job)
    db.commit()
    db.close()
    return job


def add_history(user_id, job_id, excel_file_path=None):
    db = SessionLocal()
    row = ScrapeJobHistory(
        user_id=user_id,
        job_id=job_id,
        prefix="TEST",
        start_roll=1,
        end_roll=1,
        status="completed",
        excel_file_path=excel_file_path,
    )
    db.add(row)
    db.flush()
    history_id = row.id
    db.commit()
    db.close()
    return history_id


def test_user_jobs_are_private_and_downloads_are_owner_scoped(users, tmp_path, monkeypatch):
    job_id = f"JOB-{uuid.uuid4().hex}"
    user_roots = {
        users["a_id"]: tmp_path / "user-a",
        users["b_id"]: tmp_path / "user-b",
    }
    for root in user_roots.values():
        root.mkdir()
    output = user_roots[users["a_id"]] / "result.xlsx"
    output.write_bytes(b"test workbook bytes")
    monkeypatch.setattr(server, "user_job_directory", lambda user_id, job_id=None: str(user_roots[user_id]))
    add_job(users["a_id"], job_id, "completed", {"status": "completed", "job_id": job_id, "records": [{"enrollment": "TEST01"}]}, str(output))
    add_history(users["a_id"], job_id, str(output))

    owner_status = client.get("/api/scrape/status", params={"job_id": job_id}, headers=users["a_headers"])
    assert owner_status.status_code == 200
    assert owner_status.json()["records"] == [{"enrollment": "TEST01"}]

    assert client.get("/api/scrape/status", params={"job_id": job_id}, headers=users["b_headers"]).status_code == 404
    owner_download = client.get("/api/scrape/download", params={"job_id": job_id}, headers=users["a_headers"])
    assert owner_download.status_code == 200
    assert client.get("/api/scrape/download", params={"job_id": job_id}, headers=users["b_headers"]).status_code == 404
    assert client.get("/api/scrape/download", params={"path": str(output)}, headers=users["b_headers"]).status_code == 404

    marksheet_dir = user_roots[users["a_id"]] / "marksheets"
    marksheet_dir.mkdir()
    (marksheet_dir / "TEST01.pdf").write_bytes(b"test marksheet bytes")
    assert client.get("/api/scrape/download_pdf", params={"enrollment": "TEST01"}, headers=users["a_headers"]).status_code == 200
    assert client.get("/api/scrape/download_pdf", params={"enrollment": "TEST01"}, headers=users["b_headers"]).status_code == 404

    owner_history = client.get("/api/scrape/history", headers=users["a_headers"]).json()["history"]
    other_history = client.get("/api/scrape/history", headers=users["b_headers"]).json()["history"]
    assert [row["job_id"] for row in owner_history] == [job_id]
    assert all(row["job_id"] != job_id for row in other_history)


def test_foreign_user_cannot_cancel_or_clear_owner_history(users):
    job_id = f"JOB-{uuid.uuid4().hex}"
    add_job(users["a_id"], job_id)
    history_a = add_history(users["a_id"], job_id)
    history_b = add_history(users["b_id"], f"JOB-{uuid.uuid4().hex}")
    runner = server.ScrapeJobRunner(
        prefix="TEST", start=1, end=1, pad=2, sem=None, program="B.Tech.",
        user_id=users["a_id"], job_id=job_id,
    )
    with server.runner_lock:
        server.scrape_runners[job_id] = runner

    cancel_response = client.post("/api/scrape/cancel", params={"job_id": job_id}, headers=users["b_headers"])
    assert cancel_response.status_code == 404
    assert runner._cancel_requested is False

    clear_response = client.delete("/api/scrape/history/clear", headers=users["b_headers"])
    assert clear_response.status_code == 200
    db = SessionLocal()
    assert db.query(ScrapeJobHistory).filter(ScrapeJobHistory.id == history_a).first() is not None
    assert db.query(ScrapeJobHistory).filter(ScrapeJobHistory.id == history_b).first() is None
    db.close()


def test_two_users_can_start_independent_jobs(users, monkeypatch):
    monkeypatch.setattr(server.ScrapeJobRunner, "start_job", lambda self: None)
    request = {"prefix": "TEST", "start": 1, "end": 1}
    response_a = client.post("/api/scrape/start", json=request, headers=users["a_headers"])
    response_b = client.post("/api/scrape/start", json=request, headers=users["b_headers"])
    assert response_a.status_code == 200
    assert response_b.status_code == 200
    job_a = response_a.json()["job"]["job_id"]
    job_b = response_b.json()["job"]["job_id"]
    assert job_a != job_b

    db = SessionLocal()
    row_a = db.query(ScrapeJob).filter(ScrapeJob.job_id == job_a).first()
    row_b = db.query(ScrapeJob).filter(ScrapeJob.job_id == job_b).first()
    assert row_a.user_id == users["a_id"]
    assert row_b.user_id == users["b_id"]
    db.close()


def test_websocket_events_are_targeted_to_owner_and_job(users):
    class FakeSocket:
        def __init__(self):
            self.messages = []

        async def send_json(self, message):
            self.messages.append(message)

    async def verify_routing():
        manager = server.ConnectionManager()
        owner_socket = FakeSocket()
        other_user_socket = FakeSocket()
        other_job_socket = FakeSocket()
        manager.active_connections = {
            owner_socket: (users["a_id"], "job-a"),
            other_user_socket: (users["b_id"], "job-b"),
            other_job_socket: (users["a_id"], "job-c"),
        }
        await manager.send_to_owner(users["a_id"], "job-a", {"type": "status", "job_id": "job-a"})
        assert len(owner_socket.messages) == 1
        assert other_user_socket.messages == []
        assert other_job_socket.messages == []
        await manager.send_to_owner(users["b_id"], "job-b", {"type": "status", "job_id": "job-b"})
        assert len(other_user_socket.messages) == 1
        assert len(owner_socket.messages) == 1
        assert other_job_socket.messages == []

    asyncio.run(verify_routing())


def test_scrape_endpoints_require_authentication():
    assert client.get("/api/scrape/status").status_code == 401
    assert client.get("/api/scrape/history").status_code == 401
    assert client.post("/api/scrape/start", json={"prefix": "TEST", "start": 1, "end": 1}).status_code == 401

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/ws"):
            pass
