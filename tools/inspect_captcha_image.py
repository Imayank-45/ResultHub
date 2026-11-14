import os
import glob
from PIL import Image
import ddddocr

PROJECT_DIR = r"C:\Users\mayan\OneDrive\IntelliJ IDEA Community Edition 2024.2.3\Desktop\RESULT_AI"
p = os.path.join(PROJECT_DIR, "data", "attempt_1.png")

if os.path.exists(p):
    with open(p, "rb") as f:
        img_bytes = f.read()

    ocr = ddddocr.DdddOcr(show_ad=False)
    pred_def = ocr.classification(img_bytes)

    print(f"=== ATTEMPT 1 CAPTCHA ANALYSIS ===")
    print(f"ddddocr prediction: {pred_def}")

    img = Image.open(p)
    print(f"Image format: {img.format}, size: {img.size}, mode: {img.mode}")

    # Check if pytesseract is available
    try:
        import pytesseract
        tes_pred = pytesseract.image_to_string(img, config='--psm 7 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ').strip()
        print(f"pytesseract prediction: {tes_pred}")
    except Exception as e:
        print(f"pytesseract not available: {e}")
