import sys
import os
from pypdf import PdfReader

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
pdf_path = os.path.join(PROJECT_ROOT, "test_pdf_output.pdf")

def inspect():
    reader = PdfReader(pdf_path)
    print("==================================================")
    print(" INSPECTING GENERATED MID-SEM PDF OUTPUT ")
    print("==================================================")
    print("Total Pages:", len(reader.pages))
    
    page = reader.pages[0]
    text = page.extract_text()
    print("\n--- Extracted Text ---")
    print(text)

    # Verification rules
    assert "ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY, BHOPAL" in text
    assert "DEPARTMENT OF COMPUTER SCIENCE" in text
    assert "S.No." in text
    assert "Enrollment No." in text
    assert "BT401" in text
    assert "Student Name" not in text, "Student Name column MUST be removed!"

    print("==================================================")
    print(" ALL PDF STRUCTURE CHECKS PASSED 100%! ")
    print("==================================================")

if __name__ == "__main__":
    inspect()
