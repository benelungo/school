#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Оновлює двигун у всіх презентаціях для класу.

Джерело правди — два файли:
    _Шаблони/Двигун — стилі.css
    _Шаблони/Двигун — скрипт.js

Вони ВБУДОВУЮТЬСЯ в кожен дек (а не підключаються посиланням): презентація
має відкриватися як один самодостатній файл — і з диска, і з GitHub Pages.

Як розрізняється «двигун» і «CSS цього уроку» при першому оновленні:
деки однієї генерації мають байт-у-байт однаковий старий двигун, тож
правила, які є В УСІХ деках генерації, — це двигун, а решта — CSS уроку.
Після першого запуску в файлі стоять мітки, і далі підміняються лише
блоки між ними.

Запуск:
    python3 tools/update_decks.py --analyze     показати, що буде зроблено
    python3 tools/update_decks.py               оновити (з резервною копією)
    python3 tools/update_decks.py --only "5-З/Математика/Уроки/Урок 11"
"""

import argparse
import datetime as dt
import hashlib
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TPL = ROOT / "_Шаблони"
ENGINE_CSS = TPL / "Двигун — стилі.css"
ENGINE_JS = TPL / "Двигун — скрипт.js"
BACKUP_ROOT = ROOT / "_Резервні копії"
SUFFIX = " — презентація для класу.html"

CSS_B, CSS_E = "/*=ENGINE-CSS=*/", "/*=/ENGINE-CSS=*/"
LES_B, LES_E = "/*=LESSON-CSS=*/", "/*=/LESSON-CSS=*/"
JS_B, JS_E = "/*=ENGINE-JS=*/", "/*=/ENGINE-JS=*/"

SUBJECT = {
    "Математика": "math",
    "Алгебра": "algebra",
    "Геометрія": "geometry",
    "Інформатика": "informatics",
}


# ─────────────────────────── розбір CSS ───────────────────────────
def split_rules(css):
    """CSS → список (ключ, сирий текст). Ключ — нормалізовані селектор+тіло."""
    rules, i, n = [], 0, len(css)
    while i < n:
        if css.startswith("/*", i):
            j = css.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        if css[i].isspace():
            i += 1
            continue
        start = i
        # селектор або @-правило до «{»
        j = css.find("{", i)
        if j < 0:
            break
        head = css[i:j]
        # тіло з урахуванням вкладених дужок (@media, @supports, @keyframes)
        depth, k = 0, j
        while k < n:
            if css[k] == "{":
                depth += 1
            elif css[k] == "}":
                depth -= 1
                if depth == 0:
                    break
            k += 1
        raw = css[start:k + 1]
        key = re.sub(r"\s+", " ", raw).strip()
        rules.append((key, raw))
        i = k + 1
    return rules


def deck_styles(html):
    """Усі <style> у файлі: список (start, end, вміст)."""
    return [(m.start(1), m.end(1), m.group(1))
            for m in re.finditer(r"<style>(.*?)</style>", html, re.S)]


def engine_generation(html):
    """Підпис старого двигуна — щоб згрупувати деки однієї генерації."""
    scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
    js = scripts[-1] if scripts else ""
    return hashlib.md5(js.encode()).hexdigest()[:8]


# ─────────────────────────── збір ───────────────────────────
TEMPLATE = TPL / "Презентація для класу — шаблон.html"


def find_decks(only=None, with_template=True):
    out = []
    if with_template and TEMPLATE.is_file():
        rel = TEMPLATE.relative_to(ROOT).as_posix()
        if not only or only in rel:
            out.append(TEMPLATE)
    for p in sorted(ROOT.glob("*/*/Уроки/*/*" + SUFFIX)):
        if "_Резервні копії" in p.parts or "_Шаблони" in p.parts:
            continue
        rel = p.relative_to(ROOT).as_posix()
        if only and only not in rel:
            continue
        out.append(p)
    return out


def baselines(decks):
    """Для кожної генерації — множина ключів правил, що є в УСІХ її деках."""
    groups = defaultdict(list)
    for p in decks:
        html = p.read_text(encoding="utf-8")
        gen = engine_generation(html)
        keys = set()
        for _, _, css in deck_styles(html):
            keys.update(k for k, _ in split_rules(css))
        groups[gen].append((p, keys))
    base = {}
    for gen, items in groups.items():
        if len(items) == 1:
            base[gen] = set()          # один дек у групі — нічого не перетинати
        else:
            common = set.intersection(*(k for _, k in items))
            base[gen] = common
    return groups, base


def rule_head(raw):
    """Селектор або заголовок @-правила."""
    return re.sub(r"\s+", " ", raw[:raw.find("{")]).strip()


def inner_selectors(raw):
    """Селектори всередині @media/@supports."""
    body = raw[raw.find("{") + 1:raw.rfind("}")]
    return {rule_head(r) for _, r in split_rules(body)}


def engine_index(css):
    """Що вже описує новий двигун: селектори, тексти правил, власні змінні."""
    sels, texts, props = set(), set(), set()
    for key, raw in split_rules(css):
        texts.add(key)
        head = rule_head(raw)
        if head.startswith("@"):
            sels |= inner_selectors(raw)
            for _, r in split_rules(raw[raw.find("{") + 1:raw.rfind("}")]):
                props.update(re.findall(r"(--[\w-]+)\s*:", r))
        else:
            sels.add(head)
            props.update(re.findall(r"(--[\w-]+)\s*:", raw))
    return sels, texts, props


def trim_root(raw, engine_props):
    """З :root лишаємо тільки ті змінні, яких у двигуні немає."""
    head = rule_head(raw)
    body = raw[raw.find("{") + 1:raw.rfind("}")]
    keep = []
    for decl in body.split(";"):
        d = decl.strip()
        if not d:
            continue
        m = re.match(r"(--[\w-]+)\s*:", d)
        if m and m.group(1) in engine_props:
            continue
        keep.append(d)
    return head + "{" + ";".join(keep) + "}" if keep else None


def lesson_css_of(html, base_keys, eng=None):
    """CSS саме цього уроку: без спільного двигуна і без того, що двигун уже вміє."""
    sels, texts, props = eng if eng else (set(), set(), set())
    kept = []
    for _, _, css in deck_styles(html):
        for key, raw in split_rules(css):
            if key in base_keys or key in texts:
                continue
            raw = raw.strip()
            if raw.startswith("img{max-width"):
                continue
            head = rule_head(raw)
            if head.startswith("@"):
                inner = inner_selectors(raw)
                if inner and inner <= sels:          # усе всередині двигун уже задає
                    continue
                kept.append(raw)
                continue
            if ":root" in head:
                t = trim_root(raw, props)
                if t:
                    kept.append(t)
                continue
            if head in sels:
                continue
            kept.append(raw)
    return "\n".join(kept)


def subject_of(path):
    parts = path.relative_to(ROOT).parts
    if parts[0] == "_Шаблони":
        return None                       # у шаблоні предмет ставить автор уроку
    return SUBJECT.get(parts[1], "math")


# ─────────────────────────── перебудова ───────────────────────────
def rebuild(path, base_keys, css_engine, js_engine, eng):
    html = path.read_text(encoding="utf-8")

    if CSS_B in html:                      # вже оновлений — міняємо лише двигун
        html = re.sub(re.escape(CSS_B) + r".*?" + re.escape(CSS_E),
                      lambda _: CSS_B + "\n" + css_engine + "\n" + CSS_E, html, 1, re.S)
        html = re.sub(re.escape(JS_B) + r".*?" + re.escape(JS_E),
                      lambda _: JS_B + "\n" + js_engine + "\n" + JS_E, html, 1, re.S)
        return html

    lesson = lesson_css_of(html, base_keys, eng)

    # прибираємо всі старі <style> і старий <script>
    html = re.sub(r"<style>.*?</style>\s*", "", html, flags=re.S)
    scripts = list(re.finditer(r"<script>.*?</script>", html, re.S))
    if scripts:
        last = scripts[-1]
        html = html[:last.start()] + html[last.end():]

    head_block = (
        "<style>" + CSS_B + "\n" + css_engine + "\n" + CSS_E + "</style>\n"
        "<style>" + LES_B + "\n" + lesson + "\n" + LES_E + "</style>\n"
    )
    if "</head>" not in html:
        sys.exit(f"{path}: немає </head>")
    html = html.replace("</head>", head_block + "</head>", 1)

    js_block = "<script>" + JS_B + "\n" + js_engine + "\n" + JS_E + "</script>\n"
    html = html.replace("</body>", js_block + "</body>", 1)

    # тон палітри за предметом
    subj = subject_of(path)
    if subj is None:
        return html
    if re.search(r"<html[^>]*data-subject=", html):
        html = re.sub(r'(<html[^>]*data-subject=")[^"]*(")', r"\g<1>" + subj + r"\g<2>", html, 1)
    else:
        html = re.sub(r"<html\b([^>]*)>", r'<html\1 data-subject="' + subj + '">', html, 1)
    return html


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--analyze", action="store_true", help="лише показати, нічого не писати")
    ap.add_argument("--only", help="частина шляху — оновити лише ці деки")
    args = ap.parse_args()

    for f in (ENGINE_CSS, ENGINE_JS):
        if not f.is_file():
            sys.exit(f"Немає {f}")
    css_engine = ENGINE_CSS.read_text(encoding="utf-8").strip()
    js_engine = ENGINE_JS.read_text(encoding="utf-8").strip()

    eng = engine_index(css_engine)
    all_decks = find_decks(with_template=False)   # базис — лише справжні деки
    groups, base = baselines(all_decks)
    targets = find_decks(args.only)

    if args.analyze:
        print(f"Деків: {len(all_decks)}; генерацій двигуна: {len(groups)}")
        for gen, items in groups.items():
            print(f"  {gen}: {len(items):2d} деків, спільних правил {len(base[gen])}")
        print()
        keymap = {p: k for items in groups.values() for p, k in items}
        for p in targets:
            html = p.read_text(encoding="utf-8")
            gen = engine_generation(html)
            lesson = lesson_css_of(html, base[gen], eng)
            sel = [rule_head(r)[:58] for _, r in split_rules(lesson)]
            print(f"{p.relative_to(ROOT)}")
            print(f"   ген {gen} · CSS уроку {len(lesson)} симв. · правил {len(sel)}")
            if sel:
                print("   " + "; ".join(s.strip() for s in sel[:12])
                      + (" …" if len(sel) > 12 else ""))
        return

    stamp = dt.datetime.now().strftime("%Y-%m-%d")
    bdir = BACKUP_ROOT / f"{stamp} перед оновленням двигуна"
    changed = 0
    for p in targets:
        gen = engine_generation(p.read_text(encoding="utf-8"))
        new = rebuild(p, base.get(gen, set()), css_engine, js_engine, eng)
        if new == p.read_text(encoding="utf-8"):
            continue
        dst = bdir / p.relative_to(ROOT)
        dst.parent.mkdir(parents=True, exist_ok=True)
        if not dst.exists():
            shutil.copy2(p, dst)
        p.write_text(new, encoding="utf-8")
        changed += 1
        print(f"✓ {p.relative_to(ROOT)}")
    print(f"\nОновлено деків: {changed}. Резервні копії: {bdir.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
