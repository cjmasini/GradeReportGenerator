import re
from typing import Dict, List, Tuple
import PyPDF2

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

def simple_debug_parse_text_to_map(text: str) -> Dict[str, AttendanceData]:
    """Simplified debug version with safe loop logic."""
    lines = text.split('\n')
    student_data: Dict[str, AttendanceData] = {}
    
    print(f"Processing {len(lines)} total lines")
    
    # First pass - find all potential student lines (lines that start with numbers)
    potential_student_lines = []
    for i, line in enumerate(lines):
        if re.match(r'^\d+\.\s+', line.strip()):
            potential_student_lines.append((i, line.strip()))
    
    print(f"Found {len(potential_student_lines)} potential student lines")
    
    # Show first few potential student lines
    print("\nFirst 10 potential student lines:")
    for i, (line_num, line) in enumerate(potential_student_lines[:10]):
        print(f"  {i+1}: Line {line_num}: {line[:70]}...")
    
    # Process each potential student line
    processed_count = 0
    skipped_count = 0
    
    print(f"\n=== PROCESSING STUDENTS ===")
    
    for line_num, line in potential_student_lines:
        print(f"\nProcessing line {line_num}: {line[:50]}...")
        
        # Look for continuation lines
        combined_line = line
        continuation_lines = []
        
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
                continuation_lines.append(j)
        
        if continuation_lines:
            print(f"  Found {len(continuation_lines)} continuation lines")
        
        # Parse the combined line
        student_name, attendance_tokens = split_name_and_codes(combined_line)
        
        print(f"  Name: '{student_name}'")
        print(f"  Codes: {attendance_tokens}")
        
        if student_name and attendance_tokens:
            processed_count += 1
            student_name = re.sub(r'\s+', ' ', student_name).strip()
            
            if student_name not in student_data:
                student_data[student_name] = AttendanceData()
            for tk in attendance_tokens:
                student_data[student_name].add_code(tk)
            print(f"  + SUCCESS: Added student #{processed_count}")
        else:
            skipped_count += 1
            print(f"  - SKIPPED: Missing name or codes")
            
            # Debug why it failed
            if not student_name:
                print(f"    - No name found")
            if not attendance_tokens:
                print(f"    - No attendance codes found")
                
            # Show the raw parsing attempt
            print(f"    - Raw line after index removal: '{re.sub(r'^\s*\d+[.)]?\s*', '', combined_line).strip()}'")
    
    print(f"\n=== RESULTS ===")
    print(f"Potential students found: {len(potential_student_lines)}")
    print(f"Successfully processed: {processed_count}")  
    print(f"Skipped due to parsing issues: {skipped_count}")
    print(f"Final student count: {len(student_data)}")
    
    if skipped_count > 0:
        print(f"\nWARNING: {skipped_count} students were skipped due to parsing failures")
    
    return student_data

def debug_parse_attendance_data(pdf_path: str) -> Dict[str, AttendanceData]:
    """Debug version with safe parsing."""
    if pdf_path == "":
        return {}
        
    try:
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            full_text = ""
            print(f"Reading {len(reader.pages)} pages from PDF...")
            
            for p in reader.pages:
                t = p.extract_text()
                if t:
                    full_text += t + "\n"
                    
    except Exception as e:
        raise RuntimeError(f"Error reading PDF '{pdf_path}': {e}")

    # Look for total membership to validate
    membership_matches = re.findall(r'Total Membership:\s*(\d+)', full_text)
    if membership_matches:
        expected_total = sum(int(m) for m in membership_matches)
        print(f"PDF contains Total Membership values: {membership_matches}")
        print(f"Expected total students: {expected_total}")

    data_map = simple_debug_parse_text_to_map(full_text)
    
    print(f"\nFINAL RESULT: Parsed {len(data_map)} students from attendance PDF")
    
    return data_map

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        print(f"Processing PDF: {pdf_path}")
        try:
            results = debug_parse_attendance_data(pdf_path)
            
            print(f"\nFirst 5 students:")
            for i, (name, data) in enumerate(list(results.items())[:5]):
                print(f"  {i+1}. {name}: {data}")
                
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("Usage: python script.py path_to_pdf.pdf")