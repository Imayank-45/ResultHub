"""
semester_normalizer.py
-----------------------
Normalizes semester strings ("Sem 1", "Semester I", "1st Sem") to integer 1..8.
"""

import re
from typing import Tuple

ROMAN_MAP = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8
}


def normalize_semester(raw_semester: str) -> Tuple[int, str]:
    """
    Returns (semester_number: int, normalized_title: str)
    """
    if isinstance(raw_semester, int):
        s_num = max(1, min(8, raw_semester))
        return s_num, f"Semester {s_num}"

    s_str = str(raw_semester or "").strip()

    # Digits pattern
    m1 = re.search(r'\b([1-8])\b', s_str)
    if m1:
        s_num = int(m1.group(1))
        return s_num, f"Semester {s_num}"

    # Roman numerals
    for r_key, r_val in ROMAN_MAP.items():
        if re.search(r'\b' + r_key + r'\b', s_str, re.IGNORECASE):
            return r_val, f"Semester {r_val}"

    return 1, "Semester 1"
