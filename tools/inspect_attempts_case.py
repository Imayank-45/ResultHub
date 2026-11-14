import os
import glob
import ddddocr

ocr = ddddocr.DdddOcr(show_ad=False)

print("=== RAW DDDDOCR CASE SENSITIVITY INSPECTION ===")
data_dir = r"c:\Users\mayan\OneDrive\IntelliJ IDEA Community Edition 2024.2.3\Desktop\RESULT_AI\data"
for i in range(1, 6):
    img_path = os.path.join(data_dir, f"attempt_{i}.png")
    if os.path.exists(img_path):
        with open(img_path, "rb") as f:
            raw_bytes = f.read()
        raw_pred = ocr.classification(raw_bytes)
        print(f"Attempt {i}: Raw OCR Output = '{raw_pred}' | Upper = '{raw_pred.upper()}' | Lower = '{raw_pred.lower()}'")
