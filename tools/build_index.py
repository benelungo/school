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
# Сторінки перевірочних робіт лежать ПОРУЧ З УРОКОМ, як і презентації.
WORK_SUFFIXES = (" — контрольна для класу.html", " — самостійна для класу.html")
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


def read_work(path):
    """Витягає з HTML роботи її тип, назву й тривалість.

    Читаємо саме блок РОБОТА зі сторінки: він — єдине джерело правди про те,
    що це за робота. Дедлайн звідси НЕ беремо: чи робота відкрита, вирішує
    приймач, бо статичний сайт часу не знає.
    """
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")[:40000]
    except OSError:
        return None

    def field(name, default=""):
        m = re.search(name + r"\s*:\s*'([^']*)'", text)
        return m.group(1).strip() if m else default

    def number(name, default=0):
        m = re.search(name + r"\s*:\s*(\d+)", text)
        return int(m.group(1)) if m else default

    kind = field("тип")
    if kind not in ("контрольна", "самостійна"):
        # Тип не прочитався — вгадуємо з імені файлу, щоб робота не зникла.
        kind = "самостійна" if "самостійна" in path.name else "контрольна"

    title = field("назва")
    if not title:
        rod = "Самостійна робота" if kind == "самостійна" else "Контрольна робота"
        num = number("номер", 0)
        title = f"{rod} № {num}" if num else rod

    return {
        "kind": kind,
        "title": title,
        "subject": field("предмет"),
        "theme": field("тема"),
        "minutes": number("хвилин", 0),
        "href": href_for(path),
    }


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
    lessons, works, plans_out = [], [], []
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

                # Перевірочні роботи лежать поруч з уроком, окремими файлами.
                for suffix in WORK_SUFFIXES:
                    for wpath in sorted(lesson_dir.glob("*" + suffix)):
                        w = read_work(wpath)
                        if not w:
                            continue
                        w["cls"] = class_dir.name
                        w["subject"] = w["subject"] or subject_dir.name
                        w["lesson"] = lesson_dir.name
                        # Ключ той самий, що в приймачі, — за ним сайт
                        # дізнається, чи робота відкрита зараз.
                        w["key"] = f'{w["cls"]} | {w["subject"]} | {w["title"]}'
                        works.append(w)

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

            # Майбутні уроки в списку НЕ показуємо: у 5-З математиці їх
            # 173, і проведені загубилися б. Замість цього — окрема панель
            # «показати майбутні» з темами й назвами уроків із КТП.
            if ktp:
                done = set(done_numbers)
                by_theme = {}
                for n in sorted(ktp):
                    theme, title = ktp[n]
                    if not theme:
                        continue
                    b = by_theme.setdefault(theme, {"theme": theme, "lessons": []})
                    b["lessons"].append({"n": n, "title": title, "done": n in done})
                order = {t: i for i, t in enumerate(themes)}
                plans_out.append({
                    "cls": class_dir.name,
                    "subject": subject_dir.name,
                    "themes": sorted(by_theme.values(),
                                     key=lambda t: order.get(t["theme"], 10**6)),
                })

    return {"lessons": lessons, "works": works, "plans": plans_out}


def write_index(data):
    if not INDEX.is_file():
        sys.exit("Немає index.html у корені проєкту — спершу створи його.")

    html = INDEX.read_text(encoding="utf-8")
    if START not in html or END not in html:
        sys.exit("В index.html немає міток BUILD:LESSONS — вставити список нікуди.")

    payload = json.dumps(data, ensure_ascii=False, indent=1)
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
    data = collect()
    changed = write_index(data)

    lessons = data["lessons"]
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

    if data["works"]:
        print(f"Перевірочних робіт: {len(data['works'])}")
        for w in data["works"]:
            print(f"  {w['key']}  ({w['minutes']} хв)  {w['href']}")
    else:
        print("Перевірочних робіт не знайдено.")
    тем = sum(len(p["themes"]) for p in data["plans"])
    print(f"Планів із КТП: {len(data['plans'])} (тем усього {тем}).")
    print("index.html оновлено." if changed else "index.html і так актуальний.")


if __name__ == "__main__":
    main()
