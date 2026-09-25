#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Перевіряє презентації для класу в headless Chrome:
  • чи не впав скрипт (JS-помилки, зокрема під час побудови компонентів);
  • чи влазить кожен слайд у екран, коли ВСІ відповіді відкриті;
  • чи згенерувалися QR, числові прямі, стовпчики;
  • чи є в уроці завдання з випадковим номером (обовʼязкове правило).

Пастка, через яку раніше перевірка «проходила» помилково:
висоту, доступну слайду, НЕ можна брати як #sheet.clientHeight — лист
розтягується під вміст. Міряємо від вікна:
    innerHeight − #topic.offsetHeight − padding-top − padding-bottom

Запуск:
    python3 tools/check_decks.py                       усі деки
    python3 tools/check_decks.py --only "Урок 11"
    python3 tools/check_decks.py --size 1280x720
"""

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SUFFIX = " — презентація для класу.html"
SIZES = [(1440, 900), (1280, 720)]

HEAD_HOOK = """<script>
window.__errs=[];
window.addEventListener('error',function(e){window.__errs.push(String(e.message||e.error)+' @'+(e.lineno||'?'))});
window.addEventListener('unhandledrejection',function(e){window.__errs.push('promise: '+e.reason)});
</script>
"""

TAIL_HOOK = """<div id="__R" style="display:none"></div>
<script>
function __report(){
  var out=[], slides=[].slice.call(document.querySelectorAll('.slide'));
  var sheet=document.getElementById('sheet'), topic=document.getElementById('topic');
  var cs=getComputedStyle(sheet);
  var avail=window.innerHeight-(topic?topic.offsetHeight:0)
            -parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
  slides.forEach(function(s,i){
    slides.forEach(function(x){x.classList.remove('on')});
    s.classList.add('on');
    [].slice.call(s.querySelectorAll('.hide')).forEach(function(h){h.classList.add('on')});
    s.style.transform='';
    var h=s.scrollHeight;
    out.push({i:i+1,t:s.dataset.t||'',h:Math.round(h),k:h>avail?+(avail/h).toFixed(3):1});
  });
  /* Слайд, де учні працюють самі, має сказати, ХТО відповідає: бажаючий або
     випадковий номер. Ознаки самостійної роботи — будь-яка з трьох:
       • nb-блок із прихованою відповіддю (вправа прямо в позначеному блоці);
       • чип «самостійно у зошит» (.mode.solo);
       • «у зошит» + таймер + прихована відповідь будь-де на слайді — так виглядають
         означення з прикладами, де вправу не обвели в nb.
     Виняток — чип «слухаємо пояснення» (.mode.listen): учитель сам позначив слайд
     як свій розбір, там ніхто не відповідає. */
  var noWho=[];
  slides.forEach(function(s,i){
    var work = s.querySelector('.nb.hide, .nb .hide')
            || s.querySelector('.mode.solo')
            || (s.querySelector('.mode.book') && s.hasAttribute('data-timer')
                && s.querySelector('.hide'));
    if(work && !s.querySelector('.mode.want, .mode.pick, .roster, .mode.listen'))
      noWho.push(i+1);
  });
  document.getElementById('__R').textContent=JSON.stringify({
    noWho:noWho,
    err:window.__errs,
    avail:Math.round(avail),
    slides:out,
    qr:document.querySelectorAll('.qr .pic svg').length,
    qrBoxes:document.querySelectorAll('.qr').length,
    numline:document.querySelectorAll('.numline svg').length,
    numBoxes:document.querySelectorAll('.numline').length,
    coladd:document.querySelectorAll('.coladd table.cl').length,
    coladdBoxes:document.querySelectorAll('.coladd').length,
    ordops:document.querySelectorAll('.ordops .oe span').length ? document.querySelectorAll('.ordops').length : 0,
    ordopsBoxes:document.querySelectorAll('.ordops').length,
    frm:document.querySelectorAll('.frm .fview').length,
    frmBoxes:document.querySelectorAll('.frm').length,
    fls:document.querySelectorAll('.fls .fchip').length ? document.querySelectorAll('.fls').length : 0,
    flsBoxes:document.querySelectorAll('.fls').length,
    mv:document.querySelectorAll('.mv svg').length,
    mvBoxes:document.querySelectorAll('.mv').length,
    vang:document.querySelectorAll('.vang path.p1').length ? document.querySelectorAll('.vang').length : 0,
    vangBoxes:document.querySelectorAll('.vang').length,
    qfam:document.querySelectorAll('.qfam polygon').length,
    qfamBoxes:document.querySelectorAll('.qfam').length,
    cnv:document.querySelectorAll('.cnv .gr.out .cl').length ? document.querySelectorAll('.cnv').length : 0,
    cnvBoxes:document.querySelectorAll('.cnv').length,
    back:document.querySelectorAll('.back .bstep').length ? document.querySelectorAll('.back').length : 0,
    backBoxes:document.querySelectorAll('.back').length,
    jump:document.querySelectorAll('.jump svg .ax').length ? document.querySelectorAll('.jump').length : 0,
    jumpBoxes:document.querySelectorAll('.jump').length,
    sqdiag:document.querySelectorAll('.sqdiag svg').length,
    sqdiagBoxes:document.querySelectorAll('.sqdiag').length,
    lnk:document.querySelectorAll('.lnk .fchip').length ? document.querySelectorAll('.lnk').length : 0,
    lnkBoxes:document.querySelectorAll('.lnk').length,
    regroup:document.querySelectorAll('.regroup .rline').length ? document.querySelectorAll('.regroup').length : 0,
    regroupBoxes:document.querySelectorAll('.regroup').length,
    subst:document.querySelectorAll('.subst .sv span').length ? document.querySelectorAll('.subst').length : 0,
    substBoxes:document.querySelectorAll('.subst').length,
    timers:document.querySelectorAll('.timer').length,
    pick:document.querySelectorAll('.mode.pick').length,
    roster:document.querySelectorAll('.roster').length,
    oral:document.querySelectorAll('.box.oral,.tbl.oral,.fig.oral').length,
    nb:document.querySelectorAll('.box.nb,.tbl.nb,.fig.nb').length,
    overview:document.querySelectorAll('#overview .oc').length,
    slideCount:slides.length
  });
}
window.addEventListener('load',function(){setTimeout(__report,700)});
</script>
"""


def instrument(src: Path, tmp: Path) -> Path:
    html = src.read_text(encoding="utf-8")
    html = html.replace("<head>", "<head>\n" + HEAD_HOOK, 1)
    html = html.replace("</body>", TAIL_HOOK + "</body>", 1)
    out = tmp / src.name
    out.write_text(html, encoding="utf-8")
    return out


def run(path: Path, w: int, h: int):
    cmd = [CHROME, "--headless", "--disable-gpu", "--no-sandbox",
           f"--window-size={w},{h}", "--virtual-time-budget=6000",
           "--allow-file-access-from-files", "--dump-dom", path.as_uri()]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    m = re.search(r'<div id="__R"[^>]*>(.*?)</div>', r.stdout, re.S)
    if not m:
        return None, (r.stderr or "")[-400:]
    txt = m.group(1)
    txt = (txt.replace("&quot;", '"').replace("&amp;", "&")
              .replace("&lt;", "<").replace("&gt;", ">"))
    try:
        return json.loads(txt), None
    except json.JSONDecodeError as e:
        return None, f"невалідний JSON: {e}: {txt[:200]}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--size", help="напр. 1280x720; типово обидва розміри")
    ap.add_argument("--min-scale", type=float, default=0.80,
                    help="нижче цього масштабу вважаємо проблемою")
    args = ap.parse_args()

    sizes = SIZES
    if args.size:
        w, h = args.size.lower().split("x")
        sizes = [(int(w), int(h))]

    candidates = sorted(ROOT.glob("*/*/Уроки/*/*" + SUFFIX))
    tpl = ROOT / "_Шаблони" / "Презентація для класу — шаблон.html"
    if tpl.is_file():
        candidates.insert(0, tpl)
    decks = [p for p in candidates
             if "_Резервні копії" not in p.parts
             and (not args.only or args.only in p.relative_to(ROOT).as_posix())]
    if not decks:
        sys.exit("Не знайдено деків за цим фільтром.")

    bad = 0
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        for p in decks:
            inst = instrument(p, tmp)
            name = p.relative_to(ROOT).as_posix()
            lines, problem = [], False
            for (w, h) in sizes:
                data, err = run(inst, w, h)
                if data is None:
                    lines.append(f"    {w}×{h}: НЕ ВДАЛОСЬ — {err}")
                    problem = True
                    continue
                if data["err"]:
                    lines.append(f"    {w}×{h}: JS-ПОМИЛКИ: {data['err'][:3]}")
                    problem = True
                tight = [s for s in data["slides"] if s["k"] < args.min_scale]
                worst = min((s["k"] for s in data["slides"]), default=1)
                lines.append(f"    {w}×{h}: слайдів {data['slideCount']}, "
                             f"найменший масштаб {worst:.2f}"
                             + (f", тісних {len(tight)}: "
                                + ", ".join(f"№{s['i']} {s['k']:.2f}" for s in tight[:5])
                                if tight else ""))
                if tight:
                    problem = True
                miss = []
                for key, box in (("qr", "qrBoxes"), ("numline", "numBoxes"),
                                 ("coladd", "coladdBoxes"),
                                 # анімації: контейнер є, а вмісту немає — компонент не ожив
                                 ("ordops", "ordopsBoxes"), ("frm", "frmBoxes"),
                                 ("fls", "flsBoxes"), ("mv", "mvBoxes"),
                                 ("vang", "vangBoxes"), ("qfam", "qfamBoxes"),
                                 ("cnv", "cnvBoxes"), ("back", "backBoxes"),
                                 ("sqdiag", "sqdiagBoxes"), ("lnk", "lnkBoxes"),
                                 ("regroup", "regroupBoxes"), ("subst", "substBoxes"),
                                 ("jump", "jumpBoxes")):
                    if data[box] and data[key] < data[box]:
                        miss.append(f"{key}: {data[key]}/{data[box]}")
                if miss:
                    lines.append("    компоненти не побудувались: " + "; ".join(miss))
                    problem = True
                if data["noWho"]:
                    lines.append("    вправа у зошит без способу відповіді "
                                 "(.mode.want або .mode.pick): слайди "
                                 + ", ".join("№" + str(i) for i in data["noWho"]))
                    problem = True
                if not (data["pick"] or data["roster"]):
                    lines.append("    немає завдання з випадковим номером "
                                 "(.mode.pick або .roster) — обовʼязкове в кожному уроці")
                    problem = True
                if data["overview"] != data["slideCount"]:
                    lines.append(f"    огляд: {data['overview']} карток "
                                 f"замість {data['slideCount']}")
                    problem = True
            print(("✗ " if problem else "✓ ") + name)
            for l in lines:
                print(l)
            bad += problem
    print(f"\nПеревірено {len(decks)}; з проблемами: {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
