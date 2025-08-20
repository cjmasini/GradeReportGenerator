#!/usr/bin/env python3
"""
Standalone attendance parser
- parse_attendance_data(pdf_path) -> List[Tuple[str, AttendanceData]]
"""

import re
from typing import Dict, List, Tuple
import PyPDF2
from .attendanceData import AttendanceData

# -----------------------------
# Your AttendanceData as given
# -----------------------------


# -----------------------------------
# Constants + helper (no class usage)
# -----------------------------------
VALID_CODES: List[str] = [
    'QEA','PFD', 'N/E', 'QA','QP','EA','SA','FT','NC',
    'J','H','S','I','K','M','T','A','P', '-'
]

def tokenize_codes(code_string: str) -> List[str]:
    """
    Greedy scan of a code string using the known district codes.
    Longest-first ensures multi-letter codes (PFD, QEA) are matched
    before single letters. Unknown fragments are yielded as single chars.
    """
    tokens: List[str] = []
    i = 0
    while i < len(code_string):
        matched = False
        for code in VALID_CODES:
            if code_string.startswith(code, i):
                tokens.append(code)
                i += len(code)
                matched = True
                break
        if not matched:
            tokens.append(code_string[i])  # unknown single char
            i += 1
    return tokens

def split_name_and_codes(line: str) -> Tuple[str, List[str]]:
    """
    Use the last number on the line (attendance total) to isolate only the codes.
    - name: from start up to the *first* number (grade)
    - codes: token list after the *last* number (letters and '/' kept; digits/punct dropped)
    """
    # Strip leading list index like "1.", "2)"
    s = re.sub(r'^\s*\d+[.)]?\s*', '', line).strip()

    # Find first and last numbers on the line.
    nums = list(re.finditer(r'\b\d+\b', s))
    if not nums:
        # No numbers at all → treat whole line as name.
        return s.rstrip(","), []

    first_num_start = nums[0].start()
    last_num_end = nums[-1].end()

    # Remove any glued digits at end of name (e.g., "... Jesus11")
    name = re.sub(r'\d+$', '', s[:first_num_start].strip()).rstrip(",")

    # Codes live after the last number.
    tail = s[last_num_end:].strip()

    # Remove non-letters except keep slashes so "N/E" survives
    codes_alpha = re.sub(r'[^A-Za-z/]+', '', tail)

    # Many rows start with "MF" (day header) — drop it if present.
    if codes_alpha.startswith("MF"):
        codes_alpha = codes_alpha[2:]

    return name, tokenize_codes(codes_alpha)

def parse_text_to_map(text: str) -> Dict[str, AttendanceData]:
    """
    Parse the full PDF text into a map: student_name -> AttendanceData
    Keeps prior line-combining / detection heuristics.
    """
    lines = text.split('\n')
    student_data: Dict[str, AttendanceData] = {}

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        # Student record rows start with an index like "1. "
        if re.match(r'^\d+\.\s+', line):
            combined_line = line
            j = i + 1

            # Try to combine up to 2 following lines if they look like continuations
            while j < len(lines) and j <= i + 2:
                next_line = lines[j].strip()
                if (re.match(r'^\d+\.\s+', next_line)
                    or next_line.startswith('Total')
                    or next_line.startswith('Class')):
                    break
                # Heuristic: if combining reveals a likely MF code tail, keep it
                test_combined = combined_line + ' ' + next_line
                if re.search(r'\bMF[A-Z/]+', test_combined):
                    combined_line = test_combined
                    j += 1
                else:
                    break

            # Parse the combined line
            student_name, attendance_tokens = split_name_and_codes(combined_line)

            if student_name and attendance_tokens:
                if student_name not in student_data:
                    student_data[student_name] = AttendanceData()
                for tk in attendance_tokens:
                    student_data[student_name].add_code(tk)

            i = j
        else:
            i += 1

    return student_data


# -----------------------------------
# Public entry-point (no classes)
# -----------------------------------
def parse_attendance_data(pdf_path: str) -> List[Tuple[str, AttendanceData]]:
    """
    Read a PDF and return a list of (student_name, AttendanceData) tuples, sorted by name.

    Args:
        pdf_path: path to the attendance PDF.

    Returns:
        List of (student_name, AttendanceData), sorted by student_name.
    """
    if pdf_path == "":
        return []
    try:
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            full_text = ""
            for p in reader.pages:
                t = p.extract_text()
                if t:
                    full_text += t + "\n"
    except Exception as e:
        raise RuntimeError(f"Error reading PDF '{pdf_path}': {e}")

    data_map = parse_text_to_map(full_text)
    return sorted(data_map.items(), key=lambda kv: kv[0])
