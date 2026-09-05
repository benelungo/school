#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Перебудовує список уроків усередині index.html.

Сканує структуру проєкту:
    <Клас>/<Предмет>/Уроки/Урок N/Урок N — презентація для класу.html

і вписує знайдене між мітками <!-- BUILD:LESSONS --> … <!-- /BUILD:LESSONS -->
в index.html.

Учительські файли («Урок N — презентація.html», без «для класу») самі НЕ
публікуються. Але якщо в папці уроку є тільки такий файл, урок усе одно
потрапляє до списку — з позначкою ОЧНО і БЕЗ посилання: учень бачить, що
урок був, але відкрити нічого не може.

Запуск:  python3 tools/build_index.py
"""

import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"

# файл, який бачать учні
STUDENT_SUFFIX = " — презентація для класу.html"
# учительська хронокарта: сама не публікується, але позначає урок як очний
TEACHER_SUFFIX = " — презентація.html"

START = "<!-- BUILD:LESSONS -->"
END = "<!-- /BUILD:LESSONS -->"

# папки, куди не заглядаємо
SKIP_DIRS = {".git", ".venv", ".idea", "tools", ".github", "node_modules"}


def class_sort_key(name):
    """5-З → (5, 'З'); якщо номер не розпізнано — у кінець списку."""
    m = re.match(r"^\s*(\d+)\s*-\s*(.*)$", name)
    if m:
        return (0, int(m.group(1)), m.group(2))
    return (1, 0, name)


def lesson_number(folder_name):
    """«Урок 12» → 12."""
    m = re.search(r"(\d+)", folder_name)
    return int(m.group(1)) if m else 0


def read_title(path, fallback):
    """Тема уроку — з тега <title> самої презентації."""
    try:
        head = path.read_text(encoding="utf-8", errors="replace")[:8192]
    except OSError:
        return fallback
    m = re.search(r"<title>(.*?)</title>", head, re.S | re.I)
    if not m:
        return fallback
    title = re.sub(r"\s+", " ", m.group(1)).strip()
    return title or fallback


def clean_teacher_title(title, subject, cls):
    """
    Учительські файли мають <title> виду
        «Геометрія 7-І · Урок 1 · Геометричні фігури…»
    Для картки лишаємо тільки саму тему.
    """
    parts = [p.strip() for p in title.split("·")]
    if len(parts) < 2:
        return title
    keep = [
        p for p in parts
        if subject not in p
        and cls not in p
        and not re.match(r"^Урок\s*\d+$", p)
        and p
    ]
    return " · ".join(keep) if keep else title


def count_slides(path):
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return 0
    return len(re.findall(r'<section[^>]*class="[^"]*\bslide\b', text))


def href_for(path):
    """Відносний шлях, закодований для URL (кирилиця, пробіли, тире)."""
    rel = path.relative_to(ROOT).as_posix()
    return quote(rel)


def collect():
    lessons = []
    for class_dir in sorted(
        (p for p in ROOT.iterdir() if p.is_dir() and p.name not in SKIP_DIRS
         and not p.name.startswith((".", "_"))),
        key=lambda p: class_sort_key(p.name),
    ):
        for subject_dir in sorted(p for p in class_dir.iterdir() if p.is_dir()):
            lessons_dir = subject_dir / "Уроки"
            if not lessons_dir.is_dir():
                continue
            for lesson_dir in sorted(
                (p for p in lessons_dir.iterdir() if p.is_dir()),
                key=lambda p: lesson_number(p.name),
            ):
                deck = lesson_dir / (lesson_dir.name + STUDENT_SUFFIX)
                if not deck.is_file():
                    # запасний варіант: будь-який «…для класу.html» у папці
                    found = sorted(lesson_dir.glob("*" + STUDENT_SUFFIX))
                    deck = found[0] if found else None

                item = {
                    "cls": class_dir.name,
                    "subject": subject_dir.name,
                    "n": lesson_number(lesson_dir.name),
                    "lesson": lesson_dir.name,
                }

                if deck is not None:
                    item["title"] = read_title(deck, lesson_dir.name)
                    item["slides"] = count_slides(deck)
                    item["href"] = href_for(deck)
                    lessons.append(item)
                    continue

                # Презентації для класу немає. Якщо є вчительська — урок
                # був очний: показуємо його в списку з позначкою ОЧНО,
                # але без посилання. Сам учительський файл не публікується.
                teacher = lesson_dir / (lesson_dir.name + TEACHER_SUFFIX)
                if not teacher.is_file():
                    found = sorted(lesson_dir.glob("*" + TEACHER_SUFFIX))
                    teacher = found[0] if found else None
                if teacher is None:
                    continue

                item["title"] = clean_teacher_title(
                    read_title(teacher, lesson_dir.name),
                    subject_dir.name, class_dir.name)
                item["offline"] = True
                lessons.append(item)
    return lessons


def write_index(lessons):
    if not INDEX.is_file():
        sys.exit("Немає index.html у корені проєкту — спершу створи його.")

    html = INDEX.read_text(encoding="utf-8")
    if START not in html or END not in html:
        sys.exit("В index.html немає міток BUILD:LESSONS — вставити список нікуди.")

    payload = json.dumps(lessons, ensure_ascii=False, indent=1)
    block = (
        START
        + '\n<script id="lessons" type="application/json">\n'
        + payload
        + "\n</script>\n"
        + END
    )
    new = re.sub(
        re.escape(START) + r".*?" + re.escape(END),
        lambda _: block,
        html,
        count=1,
        flags=re.S,
    )
    changed = new != html
    if changed:
        INDEX.write_text(new, encoding="utf-8")
    return changed


def main():
    lessons = collect()
    changed = write_index(lessons)

    by_class = {}
    for item in lessons:
        by_class.setdefault(item["cls"], []).append(item)

    online = sum(1 for i in lessons if not i.get("offline"))
    offline = len(lessons) - online
    print(f"Презентацій для класу: {online}"
          + (f"; очних уроків без презентації: {offline}" if offline else ""))
    for cls in sorted(by_class, key=class_sort_key):
        names = ", ".join(
            f"{i['subject']} {i['lesson'].lower()}"
            + (" [ОЧНО]" if i.get("offline") else "")
            for i in by_class[cls]
        )
        print(f"  {cls}: {names}")
    print("index.html оновлено." if changed else "index.html і так актуальний.")


if __name__ == "__main__":
    main()
