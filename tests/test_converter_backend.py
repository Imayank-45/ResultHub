"""
test_converter_backend.py
--------------------------
End-to-end verification script for ResultAI File Converter operations.
Tests:
1. Excel -> PDF
2. PDF -> Excel
3. Image -> PDF
4. Compress PDF
5. Result Excel Pre-analysis & Formatter
"""

import os
import io
import pandas as pd
from openpyxl import Workbook

from backend.converters.excel_converter import convert_excel_to_pdf
from backend.converters.pdf_converter import convert_pdf_to_excel, compress_pdf
from backend.converters.image_converter import convert_image_to_pdf
from backend.converters.result_formatter import analyze_result_excel, format_result_excel


def test_conversions():
    print("=== STARTING FILE CONVERTER BACKEND VERIFICATION ===")

    # 1. Create mock Excel sample
    wb = Workbook()
    ws = wb.active
    ws.title = "Result_Data"
    ws.append(["S.NO", "ENROLLMENT", "NAME", "RESULT", "SGPA", "CGPA"])
    ws.append([1, "0105IT241001", "RAHUL SHARMA", "PASS", 8.42, 8.15])
    ws.append([2, "0105IT241002", "PRIYA VERMA", "FAIL", 4.50, 5.20])
    ws.append([3, "0105IT241001", "RAHUL SHARMA", "PASS", 8.42, 8.15])  # duplicate for testing
    ws.append([None, None, None, None, None, None])  # empty row for testing

    excel_buf = io.BytesIO()
    wb.save(excel_buf)
    excel_bytes = excel_buf.getvalue()
    print("✓ Created sample Excel file buffer (size:", len(excel_bytes), "bytes)")

    # Test 1: Excel -> PDF
    pdf_bytes = convert_excel_to_pdf(excel_bytes)
    assert len(pdf_bytes) > 0, "Excel to PDF generated empty buffer"
    print("✓ 1. Excel -> PDF successful (PDF size:", len(pdf_bytes), "bytes)")

    # Test 2: PDF -> Excel
    extracted_excel = convert_pdf_to_excel(pdf_bytes)
    assert len(extracted_excel) > 0, "PDF to Excel generated empty buffer"
    print("✓ 2. PDF -> Excel successful (Extracted Excel size:", len(extracted_excel), "bytes)")

    # Test 3: Image -> PDF
    from PIL import Image
    img = Image.new("RGB", (300, 300), color=(124, 58, 237))
    img_buf = io.BytesIO()
    img.save(img_buf, format="PNG")
    img_bytes = img_buf.getvalue()

    pdf_from_img = convert_image_to_pdf(img_bytes)
    assert len(pdf_from_img) > 0, "Image to PDF generated empty buffer"
    print("✓ 3. Image -> PDF successful (PDF size:", len(pdf_from_img), "bytes)")

    # Test 4: Compress PDF
    compressed_pdf = compress_pdf(pdf_bytes, {"compression_level": "medium"})
    assert len(compressed_pdf) > 0, "Compress PDF generated empty buffer"
    print("✓ 4. Compress PDF successful (Compressed size:", len(compressed_pdf), "bytes)")

    # Test 5: Result Excel Pre-analysis & Formatter
    analysis = analyze_result_excel(excel_bytes, filename="Test_Result.xlsx")
    assert analysis["students_detected"] >= 2, "Pre-analysis failed to detect students"
    assert len(analysis["issues_summary"]) > 0, "Pre-analysis failed to detect duplicate student"
    print("✓ 5a. Result Excel Pre-analysis successful:")
    print("   - Students detected:", analysis["students_detected"])
    print("   - Duplicates detected:", analysis["duplicate_records_count"])
    print("   - Missing values count:", analysis["missing_values_count"])

    formatted_excel, changes = format_result_excel(excel_bytes, {
        "clean_empty_rows": True,
        "normalize_columns": True,
        "format_sgpa_cgpa": True,
        "format_pass_fail": True,
        "autofit_columns": True,
        "remove_duplicates": True
    })
    assert len(formatted_excel) > 0, "Result Excel Formatter generated empty buffer"
    print("✓ 5b. Result Excel Formatter successful:")
    print("   - Formatted Excel size:", len(formatted_excel), "bytes")
    print("   - Applied changes:", changes)

    print("\n🎉 ALL 5 FILE CONVERTER BACKEND OPERATIONAL TESTS PASSED PERFECTLY!")


if __name__ == "__main__":
    test_conversions()
