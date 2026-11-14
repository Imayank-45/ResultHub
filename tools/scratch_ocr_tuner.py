import os
import glob
import io
from PIL import Image, ImageEnhance
import ddddocr

ocr = ddddocr.DdddOcr(show_ad=False)

PROJECT_DIR = r"C:\Users\mayan\OneDrive\IntelliJ IDEA Community Edition 2024.2.3\Desktop\RESULT_AI"

def preprocess_v1_white_bg(img: Image.Image) -> bytes:
    # 1. Composite RGBA on solid white background
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        bg.paste(img, mask=img.split()[-1])
        img = bg
    else:
        img = img.convert("RGB")

    # 2. Resize 1.5x with Lanczos
    img = img.resize((int(img.width * 1.5), int(img.height * 1.5)), Image.Resampling.LANCZOS)
    img = img.convert("L")

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

def preprocess_v2_contrast(img: Image.Image) -> bytes:
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        bg.paste(img, mask=img.split()[-1])
        img = bg
    else:
        img = img.convert("RGB")

    img = img.resize((int(img.width * 2.0), int(img.height * 2.0)), Image.Resampling.LANCZOS)
    img = img.convert("L")
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.8)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

print("--- TESTING CAPTCHA OCR PREPROCESSING ---")
pattern = os.path.join(PROJECT_DIR, "data", "attempt_*.png")
attempts = sorted(glob.glob(pattern))
print(f"Found {len(attempts)} attempt images.")

for path in attempts:
    with open(path, "rb") as f:
        raw_bytes = f.read()
    raw_img = Image.open(io.BytesIO(raw_bytes))
    
    res_raw = ocr.classification(raw_bytes).strip().upper()
    
    bytes_v1 = preprocess_v1_white_bg(raw_img)
    res_v1 = ocr.classification(bytes_v1).strip().upper()

    bytes_v2 = preprocess_v2_contrast(raw_img)
    res_v2 = ocr.classification(bytes_v2).strip().upper()

    print(f"{os.path.basename(path):<15} | Raw: {res_raw:<10} | V1 (White BG + 1.5x): {res_v1:<10} | V2 (2.0x + Contrast): {res_v2:<10}")
