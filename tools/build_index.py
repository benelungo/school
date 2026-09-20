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
import subprocess
import sys
import time
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

# урок вважається новим, якщо зʼявився за стільки днів
NEW_DAYS = 10
# скільки найближчих запланованих уроків показувати після останнього готового
PLANNED_AHEAD = 2


def git_dates():
    """{шлях: unix-час останнього коміту}. Потрібно для позначки «новий»:
    час зміни файла не годиться — масове оновлення двигуна оновлює всі файли."""
    try:
        out = subprocess.run(
            ["git", "log", "--name-only", "--format=%ct", "--diff-filter=A"],
            cwd=ROOT, capture_output=True, text=True, timeout=30).stdout
    except (OSError, subprocess.SubprocessError):
        return {}
    dates, ts = {}, None
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.isdigit():
            ts = int(line)
        elif ts is not None:
            dates.setdefault(line, ts)
    return dates


def read_ktp(subject_dir):
    """КТП.docx → (теми у порядку, {№ уроку: (тема, назва)}).

    У таблиці КТП рядок-заголовок теми — це рядок, де всі клітинки однакові.
    Рядок уроку починається з номера.
    """
    plans = subject_dir / "Плани"
    # Якщо клас іде за власним курсом (є «… план курсу ….html»), офіційне КТП
    # не описує те, що реально відбувається — теми й «буде» з нього брати не можна.
    if plans.is_dir() and any(plans.glob("*план курсу*")):
        return [], {}
    path = plans / "КТП.docx"
    if not path.is_file():
        return [], {}
    try:
        from docx import Document
    except ImportError:
        return [], {}
    try:
        doc = Document(str(path))
    except Exception:
        return [], {}
    if not doc.tables:
        return [], {}

    themes, by_num, current = [], {}, None
    for row in doc.tables[0].rows:
        cells = [c.text.replace("\n", " ").strip() for c in row.cells]
        if not cells or not cells[0]:
            continue
        head = cells[0]
        if len(set(cells)) == 1:                       # обʼєднаний рядок-заголовок
            if re.match(r"^[IІ]+\s*семестр", head):
                continue                               # семестр — не тема
            current = re.sub(r"\s+", " ", head).strip()
            if current and current not in themes:
                themes.append(current)
            continue
        m = re.match(r"^(\d+)$", head)
        if not m or len(cells) < 3:
            continue
        by_num[int(m.group(1))] = (current, re.sub(r"\s+", " ", cells[2]).strip())
    return themes, by_num


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
    gdates = git_dates()
    now = time.time()
    for class_dir in sorted(
        (p for p in ROOT.iterdir() if p.is_dir() and p.name not in SKIP_DIRS
         and not p.name.startswith((".", "_"))),
        key=lambda p: class_sort_key(p.name),
    ):
        for subject_dir in sorted(p for p in class_dir.iterdir() if p.is_dir()):
            lessons_dir = subject_dir / "Уроки"
            if not lessons_dir.is_dir():
                continue
            themes, ktp = read_ktp(subject_dir)
            theme_size = {}
            for _t, _ in ktp.values():
                theme_size[_t] = theme_size.get(_t, 0) + 1
            done_numbers = []
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

                ktp_row = ktp.get(item["n"])
                if ktp_row and ktp_row[0]:
                    item["theme"] = ktp_row[0]
                    item["themeTotal"] = theme_size.get(ktp_row[0], 0)

                if deck is not None:
                    item["title"] = read_title(deck, lesson_dir.name)
                    item["slides"] = count_slides(deck)
                    item["href"] = href_for(deck)
                    rel = deck.relative_to(ROOT).as_posix()
                    ts = gdates.get(rel) or deck.stat().st_mtime
                    if now - ts < NEW_DAYS * 86400:
                        item["fresh"] = True
                    lessons.append(item)
                    done_numbers.append(item["n"])
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
                done_numbers.append(item["n"])

            # найближчі заплановані уроки з КТП — щоб було видно, що далі
            if ktp and done_numbers:
                nxt = max(done_numbers)
                added = 0
                n = nxt + 1
                while added < PLANNED_AHEAD and n in ktp:
                    theme, title = ktp[n]
                    lessons.append({
                        "cls": class_dir.name,
                        "subject": subject_dir.name,
                        "n": n,
                        "lesson": f"Урок {n}",
                        "title": title,
                        "theme": theme,
                        "themeTotal": theme_size.get(theme, 0),
                        "planned": True,
                    })
                    added += 1
                    n += 1
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

    online = sum(1 for i in lessons if not i.get("offline") and not i.get("planned"))
    offline = len(lessons) - online
    print(f"Презентацій для класу: {online}"
          + (f"; очних уроків без презентації: {offline}" if offline else ""))
    for cls in sorted(by_class, key=class_sort_key):
        names = ", ".join(
            f"{i['subject']} {i['lesson'].lower()}"
            + (" [ОЧНО]" if i.get("offline") else "")
            + (" [ПЛАН]" if i.get("planned") else "")
            for i in by_class[cls]
        )
        print(f"  {cls}: {names}")
    print("index.html оновлено." if changed else "index.html і так актуальний.")


if __name__ == "__main__":
    main()
