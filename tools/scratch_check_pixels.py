import os
import glob
from PIL import Image

PROJECT_DIR = r"C:\Users\mayan\OneDrive\IntelliJ IDEA Community Edition 2024.2.3\Desktop\RESULT_AI"
pattern = os.path.join(PROJECT_DIR, "data", "attempt_*.png")
attempts = sorted(glob.glob(pattern))

print("=== IMAGE PROPERTIES & MODES ===")
for p in attempts:
    img = Image.open(p)
    print(f"{os.path.basename(p):<15} | Mode: {img.mode:<6} | Size: {img.size} | Info: {img.info}")
