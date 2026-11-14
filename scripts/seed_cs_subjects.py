import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.db.database import SessionLocal
from backend.db.models import MidSemSubject

CS_SUBJECTS = {
    "I": [
        {"subject_code": "BT101", "subject_name": "Engineering Chemistry", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT102", "subject_name": "Mathematics-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT103", "subject_name": "English for Communication", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT104", "subject_name": "Basic Electrical & Electronics Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT105", "subject_name": "Engineering Graphics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "II": [
        {"subject_code": "BT201", "subject_name": "Engineering Physics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT202", "subject_name": "Mathematics-II", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT203", "subject_name": "Basic Mechanical Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT204", "subject_name": "Basic Civil Engineering & Mechanics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT205", "subject_name": "Basic Computer Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "III": [
        {"subject_code": "ES301", "subject_name": "Energy & Environmental Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS302", "subject_name": "Discrete Structure", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS303", "subject_name": "Data Structure", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS304", "subject_name": "Digital Systems", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS305", "subject_name": "Object Oriented Programming & Methodology", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "IV": [
        {"subject_code": "BT401", "subject_name": "Mathematics-III", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS402", "subject_name": "Analysis & Design of Algorithm", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS403", "subject_name": "Software Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS404", "subject_name": "Computer Organization & Architecture", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS405", "subject_name": "Operating Systems", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "V": [
        {"subject_code": "CS501", "subject_name": "Theory of Computation", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS502", "subject_name": "Database Management System", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS503", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CS504", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
    ],
    "VI": [
        {"subject_code": "CS601", "subject_name": "Machine Learning", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS602", "subject_name": "Computer Networks", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS603", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CS604", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
    ],
    "VII": [
        {"subject_code": "CS701", "subject_name": "Software Architectures", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS702", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CS703", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ],
    "VIII": [
        {"subject_code": "CS801", "subject_name": "Internet of Things", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS802", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CS803", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ]
}

def seed_database():
    db = SessionLocal()
    inserted_count = 0
    updated_count = 0

    try:
        for branch in ["CS"]:
            for sem, subj_list in CS_SUBJECTS.items():
                for item in subj_list:
                    existing = db.query(MidSemSubject).filter(
                        MidSemSubject.program == "B.Tech.",
                        MidSemSubject.branch == branch,
                        MidSemSubject.semester == sem,
                        MidSemSubject.subject_code == item["subject_code"]
                    ).first()

                    if existing:
                        existing.subject_name = item["subject_name"]
                        existing.mst1_max = item["mst1_max"]
                        existing.mst2_max = item["mst2_max"]
                        existing.total_max = item["total_max"]
                        existing.display_order = item["display_order"]
                        existing.mst_enabled = item["mst_enabled"]
                        existing.is_elective = item["is_elective"]
                        existing.is_active = True
                        updated_count += 1
                    else:
                        rec = MidSemSubject(
                            program="B.Tech.",
                            branch=branch,
                            semester=sem,
                            subject_code=item["subject_code"],
                            subject_name=item["subject_name"],
                            mst1_max=item["mst1_max"],
                            mst2_max=item["mst2_max"],
                            total_max=item["total_max"],
                            display_order=item["display_order"],
                            mst_enabled=item["mst_enabled"],
                            is_elective=item["is_elective"],
                            is_active=True
                        )
                        db.add(rec)
                        inserted_count += 1

        db.commit()
        print(f"Database Seeding Complete! Inserted: {inserted_count}, Updated: {updated_count}")
    except Exception as e:
        db.rollback()
        print("Error during database seeding:", e)
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
