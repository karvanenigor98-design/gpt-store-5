#!/usr/bin/env python3
"""Extract GPT STORE reviews from Telegram HTML exports."""
import html
import json
import re
from datetime import datetime
from pathlib import Path

from bs4 import BeautifulSoup

SOURCES = [
    Path(r"C:/Users/User/Downloads/messages.html"),
    Path(r"C:/Users/User/Downloads/messages2.html"),
]
OUT = Path(__file__).resolve().parent.parent / "data" / "gpt-telegram-reviews.json"
GROUP_LINK_PREFIX = "https://t.me/digital_sub_reviews/"

SKIP_AUTHORS = re.compile(
    r"^(наши отзывы|gpt store|support|digital sub|subs store)$",
    re.I,
)

GPT_HINT = re.compile(
    r"(chat\s*gpt|чат\s*gpt|gpt[-\s]?(4|4o|5|3|5\.5)|\bgpt\b|openai|claude|"
    r"нейросет|plus|pro\b|ии\s+ассистент|подписк[аи]\s+на\s+gpt)",
    re.I,
)
SPOTIFY_ONLY = re.compile(r"(spotify|спотифай|premium\s*spotify|spotify\s*premium)", re.I)

RU_MONTHS = {
    1: "января", 2: "февраля", 3: "марта", 4: "апреля", 5: "мая", 6: "июня",
    7: "июля", 8: "августа", 9: "сентября", 10: "октября", 11: "ноября", 12: "декабря",
}


def format_ru_date(value: str | None) -> str:
    if not value:
        return "Недавно"
    try:
        d = datetime.strptime(value, "%d.%m.%Y %H:%M:%S")
        return f"{d.day} {RU_MONTHS[d.month]} {d.year}"
    except ValueError:
        return "Недавно"


def extract_review_body(raw: str) -> str:
    text = raw.strip()
    m = re.search(r"отзыв\s*:\s*(.+?)(?:\n|$)", text, re.I | re.S)
    if m:
        text = m.group(1).strip()
    text = re.sub(r"номер\s+заказа[:#]?\s*\d+\s*", "", text, flags=re.I)
    text = re.sub(r"клиент[:#]?\s*@[\w_]+\s*", "", text, flags=re.I)
    text = re.sub(r"[⭐★☆]+", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def is_gpt_suitable(content: str, author: str) -> bool:
    if SKIP_AUTHORS.match(author.strip()):
        return False
    body = extract_review_body(content)
    if len(body) < 12:
        return False
    if re.search(r"отзыв\s*:", content, re.I):
        return True
    if GPT_HINT.search(body):
        return True
    if SPOTIFY_ONLY.search(body) and not GPT_HINT.search(body):
        return False
    if len(body) >= 25 and not SPOTIFY_ONLY.search(body):
        return True
    return False


def parse_message(message, source_file: str) -> dict | None:
    message_id_raw = message.get("id", "").replace("message", "")
    if not message_id_raw.isdigit():
        return None
    message_id = int(message_id_raw)

    forwarded = message.select_one("div.forwarded.body")
    if forwarded:
        from_el = forwarded.select_one("div.from_name")
        text_el = forwarded.select_one("div.text")
    else:
        from_el = message.select_one("div.from_name")
        text_el = message.select_one("div.text")

    date_el = message.select_one("div.pull_right.date.details")
    if not text_el:
        return None

    author_raw = (from_el.get_text(" ", strip=True) if from_el else "") or "Клиент"
    content_raw = text_el.get_text("\n", strip=True)
    if not is_gpt_suitable(content_raw, author_raw):
        return None

    content = extract_review_body(content_raw)
    if len(content) < 12:
        return None

    username = None
    author_name = author_raw
    if author_raw.startswith("@"):
        username = author_raw[1:]
        author_name = username.replace("_", " ").title()
    elif re.fullmatch(r"[A-Za-z0-9_]{5,}", author_raw):
        username = author_raw

    telegram_date = None
    sort_ts = None
    if date_el and date_el.has_attr("title"):
        telegram_date = str(date_el["title"]).split(" UTC")[0].strip()
        try:
            sort_ts = int(
                datetime.strptime(telegram_date, "%d.%m.%Y %H:%M:%S").timestamp() * 1000
            )
        except ValueError:
            sort_ts = None

    author_name = re.sub(
        r"\s*\d{1,2}[./]\d{1,2}[./]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\s*$",
        "",
        author_name,
    ).strip()
    if re.search(r"deleted\s*account", author_name, re.I) or re.fullmatch(r"\d+", author_name):
        author_name = "Клиент"

    stars = len(re.findall(r"[⭐★]", content_raw))

    return {
        "id": f"tg-{source_file}-{message_id}",
        "authorName": author_name[:80],
        "authorUsername": username,
        "content": content[:600],
        "rating": min(5, stars) if stars else 5,
        "dateLabel": format_ru_date(telegram_date),
        "sortTs": sort_ts,
        "sourceUrl": f"{GROUP_LINK_PREFIX}{message_id}",
    }


def parse_file(path: Path) -> list[dict]:
    if not path.exists():
        print(f"Skip missing: {path}")
        return []
    source = path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(source, "html.parser")
    tag = path.stem
    rows = []
    for message in soup.select("div.message.default.clearfix[id^=message]"):
        row = parse_message(message, tag)
        if row:
            rows.append(row)
    return rows


def dedupe(rows: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for row in rows:
        key = re.sub(r"\s+", " ", row["content"].lower().strip())[:120]
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def main():
    all_rows: list[dict] = []
    for src in SOURCES:
        all_rows.extend(parse_file(src))
    rows = dedupe(all_rows)
    rows.sort(key=lambda r: r.get("sortTs") or 0)
    if not rows:
        if OUT.exists():
            print(f"No HTML sources found; kept existing {OUT}")
            return
        print("No HTML sources and no existing JSON — nothing to write")
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} GPT reviews to {OUT}")


if __name__ == "__main__":
    main()
