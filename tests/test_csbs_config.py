import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from backend.mid_sem_router import DEFAULT_SUBJECTS, CSBS_DEFAULT_SUBJECTS

def test_csbs_subject_configuration():
    print("=" * 60)
    print("VERIFYING CSBS SUBJECT CONFIGURATION FOR SEMESTERS 1 TO 8")
    print("=" * 60)

    expected_semesters = {
        "I": ["CB101", "CB102", "CB103", "CB104", "CB105", "CB106"],
        "II": ["CB201", "CB202", "CB203", "CB204", "CB205", "CB206"],
        "III": ["CB301", "CB302", "CB303", "CB304", "CB305", "CB306"],
        "IV": ["CB401", "CB402", "CB403", "CB404", "CB405", "CB406"],
        "V": ["CB501", "CB502", "CB503", "CB504", "CB505", "CB506"],
        "VI": ["CB601", "CB602", "CB603", "CB604", "CB605", "CB606"],
        "VII": ["CB701", "CB702", "CB703", "CB704"],
        "VIII": ["CB801", "CB802", "CB803"],
    }

    assert "CSBS" in DEFAULT_SUBJECTS, "CSBS missing from DEFAULT_SUBJECTS mapping!"
    csbs_map = DEFAULT_SUBJECTS["CSBS"]

    for sem, expected_codes in expected_semesters.items():
        assert sem in csbs_map, f"Semester {sem} missing from CSBS configuration!"
        subjects = csbs_map[sem]
        actual_codes = [s["subject_code"] for s in subjects]
        print(f"\n[Sem {sem}] Codes: {actual_codes}")
        assert actual_codes == expected_codes, f"Sem {sem} mismatch!\nExpected: {expected_codes}\nActual: {actual_codes}"
        
        for s in subjects:
            print(f"  - {s['subject_code']}: {s['subject_name']} (Elective: {s['is_elective']})")

    print("\n" + "=" * 60)
    print("ALL CSBS SUBJECT CONFIGURATIONS VERIFIED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    test_csbs_subject_configuration()
