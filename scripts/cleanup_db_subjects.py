import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.db.database import SessionLocal
from backend.db.models import MidSemSubject

def cleanup_legacy_subjects():
    db = SessionLocal()
    try:
        # Legacy old subject codes to remove for CSE / CS
        legacy_codes = ["BT 401 M III", "CS 402 ADA", "CS 403 SE", "CS 404 COA", "CS-405 OS"]
        deleted = db.query(MidSemSubject).filter(
            MidSemSubject.subject_code.in_(legacy_codes)
        ).delete(synchronize_session=False)

        db.commit()
        print(f"Cleaned up {deleted} legacy subject records.")
    except Exception as e:
        db.rollback()
        print("Cleanup error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_legacy_subjects()
