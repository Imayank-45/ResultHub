import os
import sys
import hashlib
from PIL import Image

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from automation.scraper import RGPVScraper

def run_verification():
    print("=== EMPIRICAL STALE CAPTCHA HYPOTHESIS VERIFICATION ===")
    print("Running scraper for test student enrollments...\n")
    
    test_enrollments = ["0105IT241001", "0105IT241002", "0105IT241003"]
    
    with RGPVScraper(headless=True) as scraper:
        for enrollment in test_enrollments:
            print(f"\n=======================================================")
            print(f" TESTING ENROLLMENT: {enrollment}")
            print(f"=======================================================")
            result = scraper.fetch_result_html(enrollment, sem="1", program="B.Tech.")
            print(f"Result for {enrollment}: error={result.error}, html_length={len(result.html) if result.html else 0}")
            
    print("\n=== COMPARING SAVED ATTEMPT SCREENSHOTS ===")
    attempt_files = sorted([f for f in os.listdir("data") if f.startswith("attempt_") and f.endswith(".png")])
    
    if not attempt_files:
        print("No attempt screenshots found in data/")
        return
        
    hashes = {}
    for f in attempt_files:
        path = os.path.join("data", f)
        with open(path, "rb") as img_file:
            data = img_file.read()
            h = hashlib.sha256(data).hexdigest()[:12]
            hashes[f] = h
            img = Image.open(path)
            print(f"[{f}] Hash: {h} | Size: {img.size} ({img.width}x{img.height})")

    print("\n--- STALE CAPTCHA VERIFICATION SUMMARY ---")
    for i in range(1, len(attempt_files)):
        prev_f = attempt_files[i-1]
        curr_f = attempt_files[i]
        if hashes[prev_f] == hashes[curr_f]:
            print(f"CONFIRMED: {curr_f} is EXACTLY IDENTICAL to {prev_f}! Stale DOM synchronization confirmed.")
        else:
            print(f"CHANGED: {curr_f} differs from {prev_f}.")

if __name__ == "__main__":
    run_verification()
