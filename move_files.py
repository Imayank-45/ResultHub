import os
import shutil

ROOT = r"c:\Users\mayan\OneDrive\IntelliJ IDEA Community Edition 2024.2.3\Desktop\RESULT_AI"

moves = {
    "scripts": [
        "cleanup_db_subjects.py",
        "consolidate_aiml.py",
        "consolidate_branches.py",
        "copy_logo.py",
        "generate_logo_js.py",
        "seed_aiml_subjects.py",
        "seed_cs_subjects.py",
        "verify_aiml_subjects.py",
        "verify_cs_subjects.py",
    ],
    "tests": [
        "run_tests.py",
        "test_converter_backend.py",
        "test_endpoint_export.py",
        "test_excel_endpoint.py",
        "test_excel_freeze.py",
        "test_excel_pdf_gen.py",
        "test_freeze_fix.py",
        "test_intent_assistant.py",
        "test_marks_sheet_fix.py",
        "test_mid_sem.py",
        "test_nlp_pipeline.py",
        "test_nlp_refactor.py",
        "test_openapi.py",
        "test_redesigned_excel.py",
        "test_sync_flow.py",
    ],
    "tools": [
        "benchmark_ocr.py",
        "deep_analysis.py",
        "inspect_attempt_images.py",
        "inspect_captcha_image.py",
        "inspect_excel_output.py",
        "inspect_pdf_output.py",
        "scratch_check_pixels.py",
        "scratch_gen_excel.py",
        "scratch_gen_pdf.py",
        "scratch_ocr_tuner.py",
        "scratch_render_ascii.py",
        "scratch_test_marks_type.py",
        "scratch_test_ranges.py",
        "scratch_test_set_ranges.py",
        "scratch_test_tesseract.py",
        "verify_stale_hypothesis.py",
    ],
    "outputs": [
        "test_excel_output_v2.xlsx",
        "test_pdf_output.pdf",
        "temp.md",
    ]
}

moved_count = 0
for folder, files in moves.items():
    dest_dir = os.path.join(ROOT, folder)
    os.makedirs(dest_dir, exist_ok=True)
    for fname in files:
        src = os.path.join(ROOT, fname)
        dst = os.path.join(dest_dir, fname)
        if os.path.exists(src):
            shutil.move(src, dst)
            moved_count += 1
            print(f"Moved {fname} -> {folder}/{fname}")

print(f"\n[SUCCESS] Moved {moved_count} files successfully!")
