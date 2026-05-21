#!/usr/bin/env python3
"""Extract Spotify-suitable reviews from Telegram HTML export."""
import html
import json
import re
from datetime import datetime
from pathlib import Path

from bs4 import BeautifulSoup

SOURCE = Path(r"C:/Users/User/Downloads/Telegram Desktop/ChatExport_2026-04-23/messages.html")
OUT = Path(__file__).resolve().parent.parent / "data" / "spotify-telegram-reviews.json"
GROUP_LINK_PREFIX = "https://t.me/digital_sub_reviews/"

EXCLUDE = re.compile(
    r"(chat\s*gpt|чат\s*gpt|gpt[-\s]?(4|4o|5|3|5\.5)|\bgpt\b|openai|claude|midjourney|"
    r"нейросет|dall[\s-]?e|gemini|copilot|sora\b|видео\s*генер|"
    r"анализ\s+данн|написывать\s+текст|тексты\s+и\s+делать|"
    r"подписк[аи]\s+на\s+gpt|digital\s*sub(?!\s*spotify)|"
    r"ии\s+ассистент|нейро\b)",
    re.I,
)
SPOTIFY_HINT = re.compile(
    r"(spotify|спотифай|premium\s*spotify|spotify\s*premium|"
    r"музык|плейлист|офлайн|без\s+реклам|"
    r"иностранн.{0,12}карт|карт.{0,12}рф|оплат.{0,8}рубл|"
    r"subs\s*store|семейн|для\s+двоих|активац|подключил.{0,12}premium|"
    r"подписк.{0,12}spotify|спотиф)",
    re.I,
)
RU_MONTHS = {
    1: "января",
    2: "февраля",
    3: "марта",
    4: "апреля",
    5: "мая",
    6: "июня",
    7: "июля",
    8: "августа",
    9: "сентября",
    10: "октября",
    11: "ноября",
    12: "декабря",
}


def format_ru_date(value: str | None) -> str:
    if not value:
        return "Недавно"
    try:
        d = datetime.strptime(value, "%d.%m.%Y %H:%M:%S")
        return f"{d.day} {RU_MONTHS[d.month]} {d.year}"
    except ValueError:
        return "Недавно"


def clean_text(raw: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", raw)
    text = re.sub(r"<.*?>", "", text, flags=re.S)
    return html.unescape(text).strip()


def is_spotify_suitable(content: str) -> bool:
    if len(content) < 20:
        return False
    if EXCLUDE.search(content):
        return False
    if SPOTIFY_HINT.search(content):
        return True
    # Generic positive about subscription service without AI — only if mentions premium/music/card
    generic = re.search(
        r"(premium|премиум|подписк|музык|аккаунт|активац|подключ)",
        content,
        re.I,
    )
    return bool(generic) and not re.search(r"(gpt|бот|bot|чат\s*gpt)", content, re.I)


def parse_rows(source: str):
    rows = []
    soup = BeautifulSoup(source, "html.parser")
    for message in soup.select("div.message.default.clearfix[id^=message]"):
        message_id_raw = message.get("id", "").replace("message", "")
        if not message_id_raw.isdigit():
            continue
        message_id = int(message_id_raw)

        from_el = message.select_one("div.from_name")
        text_el = message.select_one("div.text")
        date_el = message.select_one("div.pull_right.date.details")
        if not from_el or not text_el:
            continue

        author_raw = from_el.get_text(" ", strip=True) or "Клиент"
        content = text_el.get_text("\n", strip=True)
        if not is_spotify_suitable(content):
            continue

        username = None
        author_name = author_raw
        if author_raw.startswith("@"):
            username = author_raw[1:]
            author_name = username.replace("_", " ").title()
        elif re.fullmatch(r"[A-Za-z0-9_]{5,}", author_raw):
            username = author_raw
            author_name = username.replace("_", " ").title()

        telegram_date = None
        if date_el and date_el.has_attr("title"):
            core = str(date_el["title"]).split(" UTC")[0].strip()
            telegram_date = core

        rows.append(
            {
                "id": f"tg-{message_id}",
                "authorName": author_name,
                "authorUsername": username,
                "content": content[:600],
                "rating": 5,
                "tariff": "Premium",
                "dateLabel": format_ru_date(telegram_date),
                "sourceUrl": f"{GROUP_LINK_PREFIX}{message_id}",
            }
        )
    return rows


def main():
    if not SOURCE.exists():
        raise SystemExit(f"File not found: {SOURCE}")
    source = SOURCE.read_text(encoding="utf-8", errors="ignore")
    rows = parse_rows(source)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} reviews to {OUT}")


if __name__ == "__main__":
    main()
