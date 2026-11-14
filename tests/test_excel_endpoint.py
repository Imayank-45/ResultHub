import sys
import os

PROJECT_ROOT = r"c:\Users\mayan\OneDrive\IntelliJ IDEA Community Edition 2024.2.3\Desktop\RESULT_AI"
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.db.database import SessionLocal
from backend.db.models import MidSemSession
from backend.mid_sem_router import generate_excel_sheet, generate_pdf_summary

def test_endpoint():
    db = SessionLocal()
    try:
        sess = db.query(MidSemSession).order_by(MidSemSession.id.desc()).first()
        if not sess:
            print("No MidSemSession found in database.")
            return
        print(f"Testing session id={sess.id}, branch={sess.branch}, sem={sess.semester}")
        res = generate_excel_sheet(session_id=sess.id, current_user=None, db=db)
        print(f"Excel result: {res}")
        print(f"Excel file path: {res.path}")

        pdf_res = generate_pdf_summary(session_id=sess.id, current_user=None, db=db)
        print(f"PDF result: {pdf_res}")
        print(f"PDF file path: {pdf_res.path}")
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_endpoint()
