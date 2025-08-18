# settings.py
from __future__ import annotations
import json, os
from dataclasses import dataclass, asdict, replace
from pathlib import Path
from typing import Optional

APP_NAME = "ElectronReportGenerator"

def _user_config_path(filename: str = "user.settings.json") -> Path:
    base = Path(os.getenv("APPDATA")) / APP_NAME if os.name == "nt" else Path.home() / f".config/{APP_NAME}"
    base.mkdir(parents=True, exist_ok=True)
    return base / filename

@dataclass
class Settings:
    teacher_name: str = ""
    teacher_email: str = ""
    class_name: str = ""
    report_filter_enabled: bool = False
    grade_cutoff: Optional[int] = None
    custom_message: str = ""
    default_language: str = "es"
    school_name: str = ""
    school_address: str = ""
    school_logo_dataurl: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "Settings":
        return cls(
            teacher_name=data.get("teacher_name", ""),
            teacher_email=data.get("teacher_email", ""),
            class_name=data.get("class_name", ""),
            report_filter_enabled=bool(data.get("report_filter_enabled", False)),
            grade_cutoff= data.get("grade_cutoff", ""),
            custom_message=data.get("custom_message", ""),
            default_language=data.get("default_language", "en"),
            school_name=data.get("school_name", ""),
            school_address=data.get("school_address", ""),
            school_logo_dataurl=data.get("school_logo_dataurl"),
        )

    def save_to_file(self, filepath: Optional[str | os.PathLike] = None) -> Path:
        path = Path(filepath) if filepath else _user_config_path()
        with path.open("w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)
        return path

    @classmethod
    def load_from_file(cls, filepath: Optional[str | os.PathLike] = None) -> "Settings":
        path = Path(filepath) if filepath else _user_config_path()
        if path.exists():
            try:
                with path.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                return cls.from_dict(data)
            except (json.JSONDecodeError, OSError):
                return replace(DEFAULT_SETTINGS)
        return replace(DEFAULT_SETTINGS)

# ✅ neutral defaults (no personal/school data)
DEFAULT_SETTINGS = Settings()
