import os
import glob
import io
from PIL import Image
import ddddocr

PROJECT_DIR = r"C:\Users\mayan\OneDrive\IntelliJ IDEA Community Edition 2024.2.3\Desktop\RESULT_AI"
pattern = os.path.join(PROJECT_DIR, "data", "attempt_*.png")
attempts = sorted(glob.glob(pattern))

ocr_def = ddddocr.DdddOcr(show_ad=False)
try:
    ocr_old = ddddocr.DdddOcr(show_ad=False, beta=True)
except Exception:
    ocr_old = None

print("=== DEEP ANALYSIS OF SAVED CAPTCHA ATTEMPTS ===")
for p in attempts:
    filename = os.path.basename(p)
    with open(p, "rb") as f:
        raw_bytes = f.read()

    res_def = ocr_def.classification(raw_bytes).strip().upper()
    res_old = ocr_old.classification(raw_bytes).strip().upper() if ocr_old else "N/A"

    print(f"{filename:<14} | ddddocr default: {res_def:<10} | ddddocr beta: {res_old:<10}")
