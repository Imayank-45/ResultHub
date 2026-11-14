from types import SimpleNamespace

import backend.server as server
from backend.server import ScrapeJobRunner
from backend.support_router import handle_support_chat, SupportChatRequest


def test_scrape_runner_status_contains_job_identity():
    runner = ScrapeJobRunner(
        prefix="0105IT2410",
        start=1,
        end=5,
        pad=2,
        sem="3",
        program="B.Tech.",
        user_id=42,
        job_id="JOB-test-sync",
    )

    status = runner.get_status_dict()
    assert status["prefix"] == "0105IT2410"
    assert status["start"] == 1
    assert status["end"] == 5
    assert status["job_id"] == "JOB-test-sync"


def test_support_chat_starts_job_for_authenticated_user(monkeypatch):
    runner = ScrapeJobRunner(
        prefix="0105IT2410",
        start=1,
        end=5,
        pad=2,
        sem="3",
        program="B.Tech.",
        user_id=42,
        job_id="JOB-support-test",
    )
    started_users = []

    def fake_start_job(user_id, **runner_args):
        started_users.append(user_id)
        return runner, runner.get_status_dict()

    monkeypatch.setattr(server, "start_user_scrape_job", fake_start_job)
    monkeypatch.setattr(
        "backend.support_router.get_live_job_context",
        lambda user_id: runner.get_status_dict() if user_id == 42 else None,
    )

    request = SupportChatRequest(
        messages=[],
        user_query="1 se 5 tak result nikal IT, third sem BTech ka",
    )
    response = handle_support_chat(request, current_user=SimpleNamespace(id=42))

    assert response.intent == "START_EXTRACTION"
    assert response.job_id == runner.job_id
    assert started_users == [42]
