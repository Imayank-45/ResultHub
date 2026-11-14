import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.db.database import SessionLocal
from backend.mid_sem_router import get_subjects

def verify_aiml():
    db = SessionLocal()
    try:
        sem_roman_map = {
            1: "I", 2: "II", 3: "III", 4: "IV",
            5: "V", 6: "VI", 7: "VII", 8: "VIII"
        }

        print("==================================================")
        print(" VERIFYING B.TECH -> AIML / AI SUBJECTS (SEM 1-8) ")
        print("==================================================")

        expected_codes_map = {
            "I": ["BT101", "BT102", "BT103", "BT104", "BT105"],
            "II": ["BT201", "BT202", "BT203", "BT204", "BT205"],
            "III": ["AL301", "AL302", "AL303", "AL304", "AL305"],
            "IV": ["AL401", "AL402", "AL403", "AL404", "AL405"],
            "V": ["AL501", "AL502", "AL503", "AL504"],
            "VI": ["AL601", "AL602", "AL603", "AL604"],
            "VII": ["AL701", "AL702", "AL703"],
            "VIII": ["AL801", "AL802", "AL803"]
        }

        for sem_num in range(1, 9):
            sem_roman = sem_roman_map[sem_num]
            res_aiml = get_subjects(branch="AIML", semester=sem_roman, program="B.Tech.", db=db)
            codes = [s["subject_code"] for s in res_aiml]
            print(f"AIML Sem {sem_roman} ({len(codes)} subjects): {codes}")

            expected = expected_codes_map[sem_roman]
            assert codes == expected, f"Sem {sem_roman} mismatch! Expected {expected}, got {codes}"
            print(f"  [PASS] Sem {sem_roman} exact match!")

            if sem_num >= 5:
                electives = [s["subject_code"] for s in res_aiml if s["is_elective"]]
                print(f"  Elective slots: {electives}")
                assert len(electives) == 2, f"Expected 2 elective slots for Sem {sem_roman}"

        print("==================================================")
        print(" ALL AIML SUBJECT VERIFICATIONS PASSED CLEANLY! ")
        print("==================================================")
    finally:
        db.close()

if __name__ == "__main__":
    verify_aiml()
