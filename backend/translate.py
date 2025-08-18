# backend/translate.py
from __future__ import annotations
import logging
from functools import lru_cache
from typing import Optional
import requests

log = logging.getLogger(__name__)

MYMEMORY_URL = "https://api.mymemory.translated.net/get"
HEADERS = {"User-Agent": "WIHS-ReportGenerator/1.0"}

@lru_cache(maxsize=2048)
def _cached_translate(text: str, target_language: str) -> str:
    params = {"q": text, "langpair": f"en|{target_language}"}
    resp = requests.get(MYMEMORY_URL, params=params, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    return data.get("responseData", {}).get("translatedText", text)

def translate(text: str, target_language: str = "es", *, fallback: Optional[str] = None) -> str:
    try:
        s = (text or "").strip()
        if not s:
            return text
        if target_language == "en":
            return text
        return _cached_translate(s, target_language)
    except Exception as e:
        log.debug("Translation error: %s", e)
        return fallback if fallback is not None else text
