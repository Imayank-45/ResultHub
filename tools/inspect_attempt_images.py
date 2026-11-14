import os
import glob
import io
from PIL import Image
import ddddocr

PROJECT_DIR = r"C:\Users\mayan\OneDrive\IntelliJ IDEA Community Edition 2024.2.3\Desktop\RESULT_AI"
pattern = os.path.join(PROJECT_DIR, "data", "attempt_*.png")
attempts = sorted(glob.glob(pattern))

ocr = ddddocr.DdddOcr(show_ad=False)

print("=== INSPECTING RECENT CAPTCHA ATTEMPTS ===")
for p in attempts:
    filename = os.path.basename(p)
    with open(p, "rb") as f:
        raw_bytes = f.read()

    pred_raw = ocr.classification(raw_bytes)
    pred_upper = pred_raw.upper()

    print(f"{filename:<14} | Raw: {pred_raw:<10} | Upper: {pred_upper:<10}")
