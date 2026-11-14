import os
import glob
from PIL import Image
import ddddocr

PROJECT_DIR = r"C:\Users\mayan\OneDrive\IntelliJ IDEA Community Edition 2024.2.3\Desktop\RESULT_AI"
pattern = os.path.join(PROJECT_DIR, "data", "attempt_*.png")
attempts = sorted(glob.glob(pattern))

# Engine with set_ranges for ASCII uppercase + digits ONLY
ocr_ascii = ddddocr.DdddOcr(show_ad=False)
# 6 = uppercase letters + digits in ddddocr or explicit string
try:
    ocr_ascii.set_ranges("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
except Exception as e:
    print(f"Error set_ranges string: {e}")

ocr_default = ddddocr.DdddOcr(show_ad=False)

print("=== COMPARING DEFAULT vs ASCII-ONLY SET_RANGES ===")
for p in attempts:
    filename = os.path.basename(p)
    with open(p, "rb") as f:
        raw_bytes = f.read()

    res_default = ocr_default.classification(raw_bytes)
    res_ascii = ocr_ascii.classification(raw_bytes)

    print(f"{filename:<14} | Default: {res_default:<12} | ASCII set_ranges: {res_ascii:<12}")
