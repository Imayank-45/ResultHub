import os
import glob
import sys

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(PROJECT_DIR)

from automation.ocr_engine import UniversalOCREngine

def test_ocr_verifications():
    engine = UniversalOCREngine()
    data_dir = os.path.join(PROJECT_DIR, "data")
    
    attempts = [f"attempt_{i}.png" for i in range(1, 6)]
    
    print("=== VERIFYING CAPTCHA OCR ENGINE FIX ===")
    print(f"{'Filename':<15} | {'OCR Prediction':<15} | {'Consensus':<12} | {'Winning Strategy':<25}")
    print("-" * 75)
    
    for filename in attempts:
        file_path = os.path.join(data_dir, filename)
        if not os.path.exists(file_path):
            continue
            
        with open(file_path, "rb") as f:
            raw_bytes = f.read()
            
        res = engine.solve_captcha(raw_bytes, attempt_num=1)
        if res:
            consensus_str = f"{res.consensus_count}/{res.total_strategies}"
            print(f"{filename:<15} | {res.text:<15} | {consensus_str:<12} | {res.winning_strategy:<25}")
        else:
            print(f"{filename:<15} | {'FAILED':<15} | {'0/0':<12} | {'None':<25}")
            
    print("-" * 75)
    print("Verification Completed.\n")

if __name__ == "__main__":
    test_ocr_verifications()
