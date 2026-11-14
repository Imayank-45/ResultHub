import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.db.database import SessionLocal
from backend.mid_sem_router import get_subjects

def verify_cs():
    db = SessionLocal()
    try:
        sem_roman_map = {
            1: "I", 2: "II", 3: "III", 4: "IV",
            5: "V", 6: "VI", 7: "VII", 8: "VIII"
        }

        print("==================================================")
        print(" VERIFYING B.TECH -> CS / CSE SUBJECTS (SEM 1-8) ")
        print("==================================================")

        for sem_num in range(1, 9):
            sem_roman = sem_roman_map[sem_num]
            res_cs = get_subjects(branch="CS", semester=sem_roman, program="B.Tech.", db=db)
            codes = [s["subject_code"] for s in res_cs]
            print(f"CS Sem {sem_roman} ({len(codes)} subjects): {codes}")

            # Specific check for Sem IV as requested by user
            if sem_roman == "IV":
                expected_sem4 = ["BT401", "CS402", "CS403", "CS404", "CS405"]
                assert codes == expected_sem4, f"Expected {expected_sem4}, got {codes}"
                print("  [SUCCESS] CS Sem IV exact match: BT401, CS402, CS403, CS404, CS405!")

            # Verify elective flags for Sem 5-8
            if sem_num >= 5:
                electives = [s["subject_code"] for s in res_cs if s["is_elective"]]
                print(f"  Elective slots: {electives}")
                assert len(electives) >= 2, f"Expected elective slots for Sem {sem_roman}"

        print("==================================================")
        print(" ALL CS SUBJECT VERIFICATIONS PASSED SUCCESSFULLY! ")
        print("==================================================")
    finally:
        db.close()

if __name__ == "__main__":
    verify_cs()
