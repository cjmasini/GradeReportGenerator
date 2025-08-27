import re
from typing import Dict, List, Tuple
import PyPDF2
from .util import normalize_name

# Try to import AttendanceData, handle both relative and direct imports
try:
    from .attendanceData import AttendanceData
except ImportError:
    try:
        from attendanceData import AttendanceData
    except ImportError:
        class AttendanceData:
            def __init__(self):
                self.codes = []
                self.present = 0
                self.absent = 0
                self.tardy = 0
                self.other = {}
            
            def add_code(self, code):
                self.codes.append(code)
                
            def __repr__(self):
                return f"AttendanceData(codes={self.codes})"

VALID_CODES: List[str] = [
    'QEA','PFD', 'N/E', 'QA','QP','EA','SA','FT','NC',
    'J','H','S','I','K','M','T','A','P','V', '-'
]

def tokenize_codes(code_string: str) -> List[str]:
    """Greedy scan of a code string using the known district codes."""
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
            i += 1
    return tokens

def split_name_and_codes(line: str) -> Tuple[str, List[str]]:
    """Extract student name and attendance codes using the proven fallback method."""
    # Strip leading list index like "1.", "2)"
    s = re.sub(r'^\s*\d+[.)]?\s*', '', line).strip()

    # Find all numbers in the line
    nums = list(re.finditer(r'\b\d+\b', s))
    if not nums:
        return s.rstrip(","), []

    first_num_start = nums[0].start()
    last_num_end = nums[-1].end()

    # Name is everything before the first number, cleaned up
    name = re.sub(r'\d+$', '', s[:first_num_start].strip()).rstrip(",")
    # Convert name from Last, First to First Last
    name = normalize_name(name)

    # Codes live after the last number
    tail = s[last_num_end:].strip()

    # Clean up tail - remove page footers and other junk
    tail = re.sub(r'Class Attendance Audit.*', '', tail, flags=re.IGNORECASE)
    tail = re.sub(r'Page \d+.*', '', tail, flags=re.IGNORECASE)
    tail = re.sub(r'Western International High School.*', '', tail, flags=re.IGNORECASE)

    # Remove non-letters except keep slashes so "N/E" survives
    codes_alpha = re.sub(r'[^A-Za-z/\-]+', '', tail)

    # Many rows start with "MF" (day header) — drop it if present
    if codes_alpha.startswith("MF"):
        codes_alpha = codes_alpha[2:]

    return name, tokenize_codes(codes_alpha)

def is_section_header_or_total(line: str) -> bool:
    """Check if line is a section header, total, or other non-student data"""
    line = line.strip().lower()
    if not line:
        return True
    
    skip_patterns = [
        r'^teacher:',
        r'^course:',
        r'^section:',
        r'^expression:',
        r'^total membership:',
        r'^total attendance:',
        r'^\* student off track',
        r'^class attendance audit',
        r'^page \d+',
        r'^western international high school',
        r'^august\s+september',
        r'^[amtwf\s]+$',
        r'^\d+\s+\d+\s+\d+',
        r'^student\s+gr\.',
        r'^mem\.att\.',
        r'^morales, freddy$',
        r'^damian$',
        r'^jacqueline$',
    ]
    
    for pattern in skip_patterns:
        if re.match(pattern, line):
            return True
    
    return False

def parse_text_to_map(text: str) -> Dict[str, AttendanceData]:
    """Parse text to extract student attendance data."""
    lines = text.split('\n')
    student_data: Dict[str, AttendanceData] = {}
    
    # Find all potential student lines (lines that start with numbers)
    potential_student_lines = []
    for i, line in enumerate(lines):
        if re.match(r'^\d+\.\s+', line.strip()):
            potential_student_lines.append((i, line.strip()))
    
    # Process each potential student line
    for line_num, line in potential_student_lines:
        # Look for continuation lines
        combined_line = line
        
        # Check next few lines for continuations
        for j in range(line_num + 1, min(line_num + 6, len(lines))):
            next_line = lines[j].strip()
            
            if not next_line:
                continue
                
            # Stop if we hit another numbered line or section header
            if re.match(r'^\d+\.\s+', next_line) or is_section_header_or_total(next_line):
                break
                
            # Check if it looks like a continuation
            if (re.search(r'^[A-Za-z\s,.\'-]+$', next_line) or
                re.search(r'\d{2}/\d{2}/\d{2}', next_line) or
                re.search(r'\b(PFD|N/E|[PTHVAMS])\b', next_line)):
                
                combined_line += ' ' + next_line
        
        # Parse the combined line
        student_name, attendance_tokens = split_name_and_codes(combined_line)
        
        if student_name and attendance_tokens:
            student_name = re.sub(r'\s+', ' ', student_name).strip()
            
            if student_name not in student_data:
                student_data[student_name] = AttendanceData()
            for tk in attendance_tokens:
                student_data[student_name].add_code(tk)
    
    return student_data

def parse_attendance_data(pdf_path: str) -> Dict[str, AttendanceData]:
    """Parse attendance data from PDF file."""
    if pdf_path == "":
        return {}
        
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
    
    return data_map