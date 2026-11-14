import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.db.database import SessionLocal
from backend.db.models import MidSemSubject

def consolidate():
    db = SessionLocal()
    try:
        deleted = db.query(MidSemSubject).filter(MidSemSubject.branch == "CSE").delete()
        db.commit()
        print(f"Consolidated DB: deleted {deleted} duplicate CSE branch records.")
    except Exception as e:
        db.rollback()
        print("Consolidation error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    consolidate()
