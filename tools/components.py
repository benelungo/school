#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Показує, ЩО ДВИГУН УЖЕ ВМІЄ — перш ніж вигадувати власну верстку для уроку.

Список не написаний руками: він збирається з самого двигуна
(_Шаблони/Двигун — скрипт.js і — стилі.css) і звіряється з живими
прикладами в _Шаблони/Презентація для класу — шаблон.html.
Тому він не може тихо застаріти: додав компонент — він тут зʼявиться;
забув показати його в шаблоні — скрипт це скаже.

Запуск:
    python3 tools/components.py            коротко
    python3 tools/components.py --markup   з розміткою з шаблону
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TPL = ROOT / "_Шаблони"
ENGINE_JS = TPL / "Двигун — скрипт.js"
ENGINE_CSS = TPL / "Двигун — стилі.css"
TEMPLATE = TPL / "Презентація для класу — шаблон.html"

# Опис — єдине, що тут задано руками. Якщо двигун має компонент,
# якого немає в цьому словнику, скрипт поскаржиться.
WHAT = {
    ".steps":   ("покрокове розвʼязання; останній відкритий крок підсвічується",
                 "кроки задачі, доведення, алгоритм"),
    ".fx-leg":  ("розбирання формули: наводиш на назву — підсвічується частина",
                 "як називаються числа, формули площі, теорема"),
    ".numline": ("числова пряма, точку можна тягнути; data-round показує округлення",
                 "округлення, порівняння, координати"),
    ".coladd":  ("додавання стовпчиком по розрядах із переносами",
                 "письмове додавання; досить data-a і data-b"),
    ".colsub":  ("віднімання стовпчиком: кожна цифра — крок по пробілу, з позиками й поясненням",
                 "письмове віднімання для слабших; досить data-a і data-b"),
    ".quiz":    ("вибір відповіді просто на слайді, з поясненням",
                 "швидка перевірка розуміння без «На Урок»"),
    ".roster":  ("випадковий номер за журналом, data-from…data-to; без повторів у колі",
                 "фронтальне опитування, коли відповідає не бажаючий"),
    ".qr":      ("QR-код на тест «На Урок» + код доступу великим кеглем",
                 "слайд домашнього завдання з онлайн-тестом"),
    ".count":   ("число, що набігає до значення",
                 "головна відповідь задачі — лише вона, не кожне число"),
    ".fx":      ("формула великим моноширинним кеглем із частинами <mark data-p>",
                 "разом із .fx-leg"),
    ".mode":    ("смужка «як відповідаємо»; чип .pick — сам кнопка, витягує номер",
                 "на початку уроку й над завданням"),
}

CSS_ONLY = [
    (".box  .pen .ok .warn .play .note", "кольорові картки-блоки на слайді"),
    (".box.nb / .tbl.nb / .fig.nb / .nbw", "що саме учні записують у зошит (бірюзова рамка)"),
    (".box.oral / .tbl.oral / .fig.oral / .orw",
     "усне завдання: проговорюємо, у зошит НЕ пишемо (малинова штрихова рамка)"),
    (".hide / .hide.pop / .hide.ink", "відповідь по пробілу: звичайна / пружинкою / «пишеться»"),
    (".row .c2 .c3 .c4 .c21", "колонки на слайді"),
    (".mode.want / .pick / .solo / .voice / .cam / .listen",
     "способи відповіді; .pick — клікабельний, витягує номер (data-to або data-class-size); "
     ".listen — «слухаємо пояснення», єдиний чип, де учні нічого не відповідають"),
    ("data-timer=\"секунди\"", "таймер завдання: смуга з поділками по хвилинах, ±1 хв, сигнал; двигун сам ставить його на місце"),
    ("data-lesson=\"40\" на <html>", "тривалість уроку для загального таймера в шапці (типово 40 хв; U — пауза)"),
    ("data-chapter=\"Етап\"", "етап уроку — зʼявляється в рейці прогресу й в огляді"),
    (".slide.hero + .hero-meta", "титульний слайд уроку"),
    ("details.hint", "підказка, яку відкривають лише за потреби"),
    (".eqn .step .numbig .pair .razr", "математичний набір: рівняння, крок, розряди"),
    (".fr .sq", "звичайний дріб; порожня комірка «впиши цифру»"),
    ("table.cl .cls .lt", "стовпчик руками, якщо .coladd не підходить"),
    (".tiles .tile .lamps .lamp .cw .code .word", "плитки, лампочки, шифр — для інформатики"),
    (".nextl", "«наступний урок» у кінці деку"),
]


def js_components(js):
    """Компоненти, які двигун ініціалізує сам: $$('.щось').forEach(...)"""
    return sorted(set(re.findall(r"\$\$\('\.([a-z][\w-]*)'\)\.forEach", js)))


def css_selectors(css):
    return set(re.findall(r"^\s*\.([a-z][\w-]*)", css, re.M))


def template_slides(html):
    """{клас: (номер слайда, заголовок)} — де компонент показано в шаблоні."""
    out = {}
    slides = re.findall(r"<section class=\"slide[^\"]*\"[^>]*data-t=\"([^\"]*)\"[^>]*>(.*?)</section>",
                        html, re.S)
    for i, (title, body) in enumerate(slides, 1):
        for cls in set(re.findall(r'class="([^"]*)"', body)):
            for c in cls.split():
                out.setdefault(c, (i, title))
        for attr in re.findall(r'\b(data-timer|data-chapter)=', body):
            out.setdefault(attr, (i, title))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--markup", action="store_true", help="показати розмітку з шаблону")
    args = ap.parse_args()

    for f in (ENGINE_JS, ENGINE_CSS, TEMPLATE):
        if not f.is_file():
            sys.exit(f"Немає {f.relative_to(ROOT)}")
    js = ENGINE_JS.read_text(encoding="utf-8")
    css = ENGINE_CSS.read_text(encoding="utf-8")
    tpl = TEMPLATE.read_text(encoding="utf-8")
    where = template_slides(tpl)

    print("ДОСТУПНІ КОМПОНЕНТИ — спершу шукай тут, і тільки потім пиши своє.\n")
    print("Живі — двигун сам їх будує й оживляє:")
    unknown, unshown = [], []
    for name in js_components(js):
        sel = "." + name
        desc = WHAT.get(sel)
        loc = where.get(name)
        if not desc:
            unknown.append(sel)
            desc = ("(опису немає — допиши його в tools/components.py)", "")
        mark = f"шаблон, слайд {loc[0]} «{loc[1]}»" if loc else "У ШАБЛОНІ НЕ ПОКАЗАНО"
        if not loc:
            unshown.append(sel)
        print(f"  {sel:<11s} {desc[0]}")
        if desc[1]:
            print(f"  {'':<11s} коли: {desc[1]}")
        print(f"  {'':<11s} {mark}")
    print("\nТільки стилі — розмітку пишеш сам, скрипт не потрібен:")
    for sel, desc in CSS_ONLY:
        print(f"  {sel:<38s} {desc}")

    if unknown:
        print("\n⚠ Без опису в tools/components.py: " + ", ".join(unknown))
    if unshown:
        print("⚠ Немає прикладу в шаблоні: " + ", ".join(unshown))

    if args.markup:
        print("\n" + "─" * 70 + "\nРОЗМІТКА З ШАБЛОНУ\n")
        for m in re.finditer(r"<!-- ═+ (.*?) ═+ -->\s*(<section.*?</section>)", tpl, re.S):
            print(f"── {m.group(1)} " + "─" * max(0, 60 - len(m.group(1))))
            print(m.group(2).strip()[:1400])
            print()

    print("\nНічого не підходить? Тоді пиши свій компонент — але за правилами")
    print("з «_Шаблони/Компоненти — довідник.md», розділ «Як додати новий».")
    return 0


if __name__ == "__main__":
    sys.exit(main())
