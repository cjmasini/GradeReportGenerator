import unicodedata
import re

def normalize_name(raw: str) -> str:
    if not raw or not raw.strip():
        return ""

    # Remove accents
    s = unicodedata.normalize("NFKD", raw)
    s = "".join(c for c in s if not unicodedata.combining(c))

    # Lowercase and clean punctuation
    s = s.lower().strip()
    s = re.sub(r"[^a-z\s,'-]", "", s)   # keep letters, spaces, commas, hyphens, apostrophes
    s = re.sub(r"\s+", " ", s)

    # Parse "Last, First ..." or "First ... Last"
    if "," in s:
        last, rest = [p.strip() for p in s.split(",", 1)]
        parts = rest.split()
        first = parts[0] if parts else ""
    else:
        parts = s.split()
        first = parts[0]
        last = parts[-1] if len(parts) > 1 else ""

    return f"{first.title()} {last.title()}".strip()

def sanitize_input(s):
        return str(s).replace("{","{{").replace("}","}}")