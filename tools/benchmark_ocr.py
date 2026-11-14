import os
import glob
import sys

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(PROJECT_DIR)
from automation.ocr_engine import UniversalOCREngine

def evaluate_universal_ocr():
    engine = UniversalOCREngine()
    
    data_dir = os.path.join(PROJECT_DIR, "data")
    sample_files = sorted(glob.glob(os.path.join(data_dir, "attempt_*.png")))
    if not sample_files:
        sample_files = sorted(glob.glob(os.path.join(data_dir, "*.png")))
    
    if not sample_files:
        print("No PNG samples found in data/ directory.")
        return

    print("=== UNIVERSAL ADAPTIVE OCR ENGINE BENCHMARK ===")
    print(f"Evaluating {len(sample_files)} CAPTCHA image samples...\n")
    print(f"{'Filename':<20} | {'Prediction':<10} | {'Consensus':<12} | {'Winning Strategy':<20}")
    print("-" * 75)

    for file_path in sample_files:
        filename = os.path.basename(file_path)
        with open(file_path, "rb") as f:
            raw_bytes = f.read()

        res = engine.solve_captcha(raw_bytes)
        if res:
            consensus_str = f"{res.consensus_count}/{res.total_strategies}"
            print(f"{filename:<20} | {res.text:<10} | {consensus_str:<12} | {res.winning_strategy:<20}")
        else:
            print(f"{filename:<20} | {'FAILED':<10} | {'0/5':<12} | {'None':<20}")

    print("-" * 75)
    print("Benchmark Completed Successfully.\n")

if __name__ == "__main__":
    evaluate_universal_ocr()
