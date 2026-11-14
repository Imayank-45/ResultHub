import os
import glob
from PIL import Image

PROJECT_DIR = r"C:\Users\mayan\OneDrive\IntelliJ IDEA Community Edition 2024.2.3\Desktop\RESULT_AI"
pattern = os.path.join(PROJECT_DIR, "data", "attempt_1.png")
attempts = sorted(glob.glob(pattern))

if attempts:
    img_path = attempts[0]
    img = Image.open(img_path).convert("L")
    img = img.resize((70, 20))
    print(f"=== ASCII ART OF {os.path.basename(img_path)} ===")
    for y in range(img.height):
        line = ""
        for x in range(img.width):
            p = img.getpixel((x, y))
            line += " " if p > 150 else "#"
        print(line)
