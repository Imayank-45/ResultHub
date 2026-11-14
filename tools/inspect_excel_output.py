import sys
import os
from openpyxl import load_workbook

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
filepath = os.path.join(PROJECT_ROOT, "test_excel_output_v2.xlsx")

def inspect():
    wb = load_workbook(filepath, data_only=False)
    ws = wb.active

    print("==================================================")
    print(" INSPECTING GENERATED MID-SEM EXCEL SHEET ")
    print("==================================================")
    print("Sheet Title:", ws.title)
    print("Freeze Panes:", ws.freeze_panes)

    # Check Headers
    print("\n--- Header Row 1 ---")
    print("A1 Cell Value:", repr(ws["A1"].value))
    print("D1 Cell Value:", repr(ws["D1"].value))

    print("\n--- Header Row 4 & 5 (Column Titles) ---")
    headers_row4 = [ws.cell(row=4, column=c).value for c in range(1, 13)]
    headers_row5 = [ws.cell(row=5, column=c).value for c in range(1, 13)]
    print("Row 4:", headers_row4)
    print("Row 5:", headers_row5)

    print("\n--- Data Row 6 (Student 1) ---")
    row_6 = [ws.cell(row=6, column=c).value for c in range(1, 13)]
    print("Row 6 Data:", row_6)

    # Verifications
    assert ws.freeze_panes == "C6", f"Expected freeze_panes='C6', got {ws.freeze_panes}"
    assert headers_row4[0] == "S.NO."
    assert headers_row4[1] == "ENROLLMENT NO."
    assert headers_row4[2] == "BT401"
    assert "NAME OF STUDENT" not in headers_row4, "NAME OF STUDENT column must be removed!"
    assert row_6[0] == 1
    assert row_6[1] == "0105CS241001"

    print("==================================================")
    print(" ALL EXCEL STRUCTURE CHECKS PASSED 100%! ")
    print("==================================================")

if __name__ == "__main__":
    inspect()
