from __future__ import annotations
import argparse, json, sys, os
from typing import Dict, List, Tuple

app_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if app_root not in sys.path:
    sys.path.insert(0, app_root)

try:
    from settings import Settings
except ImportError:
    from backend.settings import Settings

try:
    from backend.report_generator import (
        generate_report_for_selected,
        parse_students,
    )
except ImportError:
    from report_generator import (
        generate_report_for_selected,
        parse_students,
    )

def emit(kind: str, **payload):
    print(json.dumps({"type": kind, **payload}), flush=True)

def list_students_cmd(input_path: str, settings: Settings):
    students = parse_students(input_path, settings)
    items = [
        {"name": s.name, "percent": s.percent, "grade": s.grade, "first_name": s.first_name}
        for s in students
    ]
    emit("students", items=items)

def generate_selected_cmd(scoresheet_path: str, selection_json: str, settings: Settings, output_path: str, attendance_path = ""):
    try:
        with open(selection_json, "r", encoding="utf-8") as f:
            sel = json.load(f)
    except Exception as e:
        emit("error", error=f"Could not read selection JSON: {e}")
        return 1

    selected_map: Dict[str, bool] = sel.get("selected", {})
    lang_map: Dict[str, str] = sel.get("languages", {})

    students = parse_students(scoresheet_path, settings)
    pairs: List[Tuple] = []
    for s in students:
        if selected_map.get(s.name, False):
            pairs.append((s, lang_map.get(s.name, settings.default_language)))

    def progress_cb(pct: int):
        emit("progress", value=int(pct))

    output_path = generate_report_for_selected(
        settings=settings,
        student_language_pairs=pairs,
        output_dir=None,
        on_progress=progress_cb,
    )
    emit("done", output=output_path)
    return 0

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--settings", type=str, help="Path to settings JSON (defaults to user.settings)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    ls = sub.add_parser("list-students")
    ls.add_argument("--input", required=True)

    gen_sel = sub.add_parser("generate-selected")
    gen_sel.add_argument("--input", required=True)
    gen_sel.add_argument("--selection", required=True)
    gen_sel.add_argument("--output-dir", default="")
    gen_sel.add_argument("--attendance", default="")

    args = parser.parse_args()
    settings = Settings.load_from_file(filepath=args.settings) if args.settings else Settings.load_from_file()

    if args.cmd == "list-students":
        list_students_cmd(args.input, settings)
        return
    if args.cmd == "generate-selected":
        sys.exit(generate_selected_cmd(args.input, args.selection, settings, args.output_dir, args.attendance))
        return

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        emit("error", error=str(e))
        sys.exit(1)
