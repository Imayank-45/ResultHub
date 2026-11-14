import sys
import os

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(TESTS_DIR)

if TESTS_DIR not in sys.path:
    sys.path.insert(0, TESTS_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

VENV_SITE_PACKAGES = os.path.join(PROJECT_ROOT, "venv", "Lib", "site-packages")
if os.path.exists(VENV_SITE_PACKAGES) and VENV_SITE_PACKAGES not in sys.path:
    sys.path.insert(0, VENV_SITE_PACKAGES)

os.chdir(PROJECT_ROOT)

# Re-configure stdout to UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from test_mid_sem import (
    setup_database,
    test_1_roll_and_enrollment_generation,
    test_2_student_name_lookup,
    test_3_subject_loading_and_seeding,
    test_4_mark_validation_and_total_calculation,
    test_5_reference_sample_data_excel_generation,
    test_6_mark_absent_both_logic,
    test_7_mark_absent_mst1_partial_logic,
    test_8_subject_master_db_auto_loading,
    test_9_mst_enabled_filtering
)
import tempfile
import pathlib

def run_all_tests():
    print("=" * 60)
    print("Starting Mid-Sem Studio Automated Test Suite")
    print("=" * 60)
    
    setup_database()
    print("[PASS] Database schema initialized!")
    
    test_1_roll_and_enrollment_generation()
    print("[PASS] Test 1: Roll & Enrollment generation passed!")

    test_2_student_name_lookup()
    print("[PASS] Test 2: Student name resolution lookup passed!")

    test_3_subject_loading_and_seeding()
    print("[PASS] Test 3: Dynamic subject loading & seeding passed!")

    test_4_mark_validation_and_total_calculation()
    print("[PASS] Test 4: Marks bounds validation & total calculations passed!")

    tmp_dir = pathlib.Path(tempfile.gettempdir())
    test_5_reference_sample_data_excel_generation(tmp_dir)
    print("[PASS] Test 5: Reference sample data (Aaditya Thakur) & OpenPyXL Excel output passed!")

    test_6_mark_absent_both_logic()
    print("[PASS] Test 6: Mark Absent Both MST-I & MST-II logic passed!")

    test_7_mark_absent_mst1_partial_logic()
    print("[PASS] Test 7: Partial Absence (MST-I only) logic & total preservation passed!")

    test_8_subject_master_db_auto_loading()
    print("[PASS] Test 8: Subject Master DB auto-loading for B.Tech IT Sem IV passed!")

    test_9_mst_enabled_filtering()
    print("[PASS] Test 9: Non-MST subject filtering (mst_enabled=False) passed!")

    print("=" * 60)
    print("ALL 9 MID-SEM STUDIO UNIT TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_all_tests()



