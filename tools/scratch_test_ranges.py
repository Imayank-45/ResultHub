import os
import glob
import io
from PIL import Image, ImageEnhance
import ddddocr

PROJECT_DIR = r"C:\Users\mayan\OneDrive\IntelliJ IDEA Community Edition 2024.2.3\Desktop\RESULT_AI"
pattern = os.path.join(PROJECT_DIR, "data", "attempt_*.png")
attempts = sorted(glob.glob(pattern))

# Engine 1: Default
ocr_def = ddddocr.DdddOcr(show_ad=False)

# Engine 2: Old beta model
try:
    ocr_old = ddddocr.DdddOcr(show_ad=False, beta=True)
except Exception:
    ocr_old = None

print("=== TESTING DDDDOCR MODELS & PREPROCESSING ===")
for p in attempts:
    filename = os.path.basename(p)
    with open(p, "rb") as f:
        raw_bytes = f.read()
    
    res_def = ocr_def.classification(raw_bytes).strip().upper()
    res_old = ocr_old.classification(raw_bytes).strip().upper() if ocr_old else "N/A"
    
    # Process image: resize + contrast
    img = Image.open(io.BytesIO(raw_bytes))
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        bg.paste(img, mask=img.split()[-1])
        img = bg
    else:
        img = img.convert("RGB")
        
    img = img.resize((img.width * 2, img.height * 2), Image.Resampling.LANCZOS)
    img_gray = img.convert("L")
    enhancer = ImageEnhance.Contrast(img_gray)
    img_contrast = enhancer.enhance(1.8)
    
    buf = io.BytesIO()
    img_contrast.save(buf, format='PNG')
    proc_bytes = buf.getvalue()
    
    res_def_proc = ocr_def.classification(proc_bytes).strip().upper()
    res_old_proc = ocr_old.classification(proc_bytes).strip().upper() if ocr_old else "N/A"
    
    print(f"{filename:<14} | Default: {res_def:<8} | Default+Proc: {res_def_proc:<8} | Beta Model: {res_old:<8} | Beta+Proc: {res_old_proc:<8}")
