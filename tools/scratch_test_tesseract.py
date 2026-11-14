import os
import glob
import io
from PIL import Image, ImageOps, ImageEnhance, ImageFilter
import ddddocr

ocr = ddddocr.DdddOcr(show_ad=False)

PROJECT_DIR = r"C:\Users\mayan\OneDrive\IntelliJ IDEA Community Edition 2024.2.3\Desktop\RESULT_AI"
pattern = os.path.join(PROJECT_DIR, "data", "attempt_*.png")
attempts = sorted(glob.glob(pattern))

def test_variations(path):
    filename = os.path.basename(path)
    with open(path, "rb") as f:
        raw_bytes = f.read()
    
    img = Image.open(io.BytesIO(raw_bytes))
    
    # Raw
    p_raw = ocr.classification(raw_bytes).strip().upper()
    
    # White BG + Thresholding
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        bg.paste(img, mask=img.split()[-1])
        img_rgb = bg
    else:
        img_rgb = img.convert("RGB")
        
    img_gray = img_rgb.convert("L")
    
    # Resize 3x
    img_3x = img_gray.resize((img_gray.width * 3, img_gray.height * 3), Image.Resampling.LANCZOS)
    
    # Threshold variants
    # Threshold 120
    t120 = img_3x.point(lambda p: 255 if p > 120 else 0)
    buf = io.BytesIO()
    t120.save(buf, format='PNG')
    p_t120 = ocr.classification(buf.getvalue()).strip().upper()

    # Threshold 160
    t160 = img_3x.point(lambda p: 255 if p > 160 else 0)
    buf = io.BytesIO()
    t160.save(buf, format='PNG')
    p_t160 = ocr.classification(buf.getvalue()).strip().upper()

    # Inverted
    inv = ImageOps.invert(t140 := img_3x.point(lambda p: 255 if p > 140 else 0))
    buf = io.BytesIO()
    inv.save(buf, format='PNG')
    p_inv = ocr.classification(buf.getvalue()).strip().upper()

    print(f"{filename:<15} | Raw: {p_raw:<8} | T120: {p_t120:<8} | T160: {p_t160:<8} | Inv: {p_inv:<8}")

print("=== DETAILED OCR VARIATION TEST ===")
for p in attempts:
    test_variations(p)
