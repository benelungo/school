#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Перевіряє презентації для класу в headless Chrome:
  • чи не впав скрипт (JS-помилки, зокрема під час побудови компонентів);
  • чи влазить кожен слайд у екран НА КОЖНОМУ КРОЦІ: дек гортається пробілом
    від початку до кінця, як на уроці, і береться найбільша висота слайда;
  • чи має задача «у зошит» бірюзову рамку; чи не суперечать «самостійно у
    зошит» і рамка «усно»; чи не розірваний етап у рейці; чи примітка
    «Як розвʼязувати» не дрібним .lab (15.10.2026, огляд уроків 5-З, 7-І, 8-К);
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

HEAD_HOOK = """<style>
/* Вхідна анімація слайда (sl-lift, fill-mode both) у віртуальному часі headless
   Chrome не добігає кінця й перекриває transform: scale() від fit() — слайд
   міряється нестиснутим. На живому екрані вона за 0,34 с закінчується. */
.slide.on{animation:none!important}
</style>
<script>
window.__errs=[];
window.addEventListener('error',function(e){window.__errs.push(String(e.message||e.error)+' @'+(e.lineno||'?'))});
window.addEventListener('unhandledrejection',function(e){window.__errs.push('promise: '+e.reason)});
</script>
"""

TAIL_HOOK = """<div id="__R" style="display:none"></div>
<script>
/* Прохід як на уроці (15.10.2026): дек гортається пробілом від першого слайда до
   останнього, і висота кожного слайда береться НАЙБІЛЬША за всі його кроки.
   Раніше міряли один стан — «усі .hide відкриті», а компоненти (куточок,
   стовпчик, .frm) при цьому лишались на першому кроці. Так у 5-З № 430 відповідь
   після останнього кроку йшла під панель, а перевірка казала «влазить». */
function __comp(){ return {
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
    sgn:document.querySelectorAll('.sgn .sview .fr').length ? document.querySelectorAll('.sgn').length : 0,
    sgnBoxes:document.querySelectorAll('.sgn').length,
    hist:document.querySelectorAll('.hist .hb').length ? document.querySelectorAll('.hist').length : 0,
    histBoxes:document.querySelectorAll('.hist').length,
    ocr:document.querySelectorAll('.ocr .og .cl').length ? document.querySelectorAll('.ocr').length : 0,
    ocrBoxes:document.querySelectorAll('.ocr').length,
    sepia:document.querySelectorAll('.sepia .sp-r').length ? document.querySelectorAll('.sepia').length : 0,
    sepiaBoxes:document.querySelectorAll('.sepia').length,
    poster:document.querySelectorAll('.poster .ps-b').length ? document.querySelectorAll('.poster').length : 0,
    posterBoxes:document.querySelectorAll('.poster').length,
    srch:document.querySelectorAll('.srch .sr-p').length ? document.querySelectorAll('.srch').length : 0,
    srchBoxes:document.querySelectorAll('.srch').length,
    pult:document.querySelectorAll('.pult canvas').length ? document.querySelectorAll('.pult').length : 0,
    pultBoxes:document.querySelectorAll('.pult').length,
    ppt:document.querySelectorAll('.ppt .pp-win').length ? document.querySelectorAll('.ppt').length : 0,
    flip:document.querySelectorAll('.flip .flv .fdiv').length ? document.querySelectorAll('.flip').length : 0,
    flipBoxes:document.querySelectorAll('.flip').length,
    pptBoxes:document.querySelectorAll('.ppt').length,
    colmul:document.querySelectorAll('.colmul table.cl td').length ? document.querySelectorAll('.colmul').length : 0,
    colmulBoxes:document.querySelectorAll('.colmul').length,
    coldiv:document.querySelectorAll('.coldiv table.cl td').length ? document.querySelectorAll('.coldiv').length : 0,
    coldivBoxes:document.querySelectorAll('.coldiv').length,
    packs:document.querySelectorAll('.packs .pk-b').length ? document.querySelectorAll('.packs').length : 0,
    packsBoxes:document.querySelectorAll('.packs').length,
    pow:document.querySelectorAll('.pow .pw-f').length ? document.querySelectorAll('.pow').length : 0,
    powBoxes:document.querySelectorAll('.pow').length,
    sqcube:document.querySelectorAll('.sqcube .sc-part').length ? document.querySelectorAll('.sqcube').length : 0,
    sqcubeBoxes:document.querySelectorAll('.sqcube').length,
    tr180:[].filter.call(document.querySelectorAll('.tr180'),function(b){var p=b.querySelector('.tr-svg .sh');return p&&p.getAttribute('points');}).length,
    tr180Boxes:document.querySelectorAll('.tr180').length,
    trisos:[].filter.call(document.querySelectorAll('.trisos'),function(b){var p=b.querySelector('.tr-svg .sh');return p&&p.getAttribute('points');}).length,
    trisosBoxes:document.querySelectorAll('.trisos').length,
    trkind:[].filter.call(document.querySelectorAll('.trkind'),function(b){var p=b.querySelector('.tr-svg .sh');return p&&p.getAttribute('points');}).length,
    trkindBoxes:document.querySelectorAll('.trkind').length,
    qinsc:[].filter.call(document.querySelectorAll('.qinsc'),function(b){var p=b.querySelector('.tr-svg .sh');return p&&p.getAttribute('points');}).length,
    qinscBoxes:document.querySelectorAll('.qinsc').length,
    qcirc:[].filter.call(document.querySelectorAll('.qcirc'),function(b){var p=b.querySelector('.tr-svg .sh');return p&&p.getAttribute('points');}).length,
    qcircBoxes:document.querySelectorAll('.qcirc').length,
    shl:document.querySelectorAll('.shl table.sh-t td').length ? document.querySelectorAll('.shl').length : 0,
    shlBoxes:document.querySelectorAll('.shl').length,
    rainbow:[].filter.call(document.querySelectorAll('.rainbow'),function(b){return b.querySelector('.rb-top .rb-t, .rb-top .rb-v');}).length,
    rainbowBoxes:document.querySelectorAll('.rainbow').length,
    fan:document.querySelectorAll('.fan svg line').length ? document.querySelectorAll('.fan').length : 0,
    fanBoxes:document.querySelectorAll('.fan').length,
    dom:document.querySelectorAll('.dom .dm-c').length ? document.querySelectorAll('.dom').length : 0,
    domBoxes:document.querySelectorAll('.dom').length,
    req:document.querySelectorAll('.req .rq-n').length ? document.querySelectorAll('.req').length : 0,
    reqBoxes:document.querySelectorAll('.req').length,
    sqdiag:document.querySelectorAll('.sqdiag svg').length,
    sqdiagBoxes:document.querySelectorAll('.sqdiag').length,
    lnk:document.querySelectorAll('.lnk .fchip').length ? document.querySelectorAll('.lnk').length : 0,
    lnkBoxes:document.querySelectorAll('.lnk').length,
    regroup:document.querySelectorAll('.regroup .rline').length ? document.querySelectorAll('.regroup').length : 0,
    regroupBoxes:document.querySelectorAll('.regroup').length,
    subst:document.querySelectorAll('.subst .sv span').length ? document.querySelectorAll('.subst').length : 0,
    substBoxes:document.querySelectorAll('.subst').length
}; }
var __early=null;
var __maxH=[], __steps=[];
function __slides(){ return [].slice.call(document.querySelectorAll('.slide')); }
function __cur(sl){ for(var i=0;i<sl.length;i++) if(sl[i].classList.contains('on')) return i; return -1; }
function __measure(sl){
  var c=__cur(sl); if(c<0) return;
  var h=sl[c].scrollHeight;
  if(!(__maxH[c]>=h)) __maxH[c]=h;
}
function __walk(){
  /* чи побудувались компоненти — рахуємо ДО проходу: компоненти на кнопках
     (.jump, .mv) під час кроків перебудовують себе, і після проходу їх не впізнати */
  __early=__comp();
  document.documentElement.setAttribute('data-fx','none');   /* без View Transitions — кроки синхронні */
  var sl=__slides(), n=0, last=sl.length-1;
  sl.forEach(function(){ __maxH.push(0); __steps.push(0); });
  function press(){
    document.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight',key:'ArrowRight',bubbles:true}));
    n++;
    setTimeout(tick,60);
  }
  function tick(){
    __measure(sl);
    var c=__cur(sl);
    __peek(sl,c);
    var left=sl[c] ? sl[c].querySelectorAll('.hide:not(.on)').length : 0;
    if(left){ __steps[c]++; press(); return; }
    /* слайд розкрито до кінця: даємо двигуну дорахувати масштаб і дивимось, що
       бачить учень — чи не зайшло щось під нижню панель */
    setTimeout(function(){
      __measure(sl); __clip(sl,c);
      if(c===last || n>3000){ __report(); return; }
      press();
    },1300);                       /* двигун дораховує масштаб із запасом до 1,1 с */
  }
  tick();
}
/* Відповідь видно ДО кроку: елемент під .hide, який ще не відкрито, а на екрані в
   ньому читаються числа (чужий стиль перебив .hide{opacity:0}). 15.10.2026: «.steps .st{opacity:.34}»
   показувало всі кроки розвʼязку з відповідями напівпрозорими з першої секунди. */
var __peekSeen=[], __peekBad=[];
function __peek(sl,c){
  if(c<0 || __peekSeen[c]) return; __peekSeen[c]=1;
  var bad=0;
  [].forEach.call(sl[c].querySelectorAll('.hide:not(.on)'),function(h){
    if(!h.textContent.trim() && !h.querySelector('svg,img,canvas')) return;
    var e=h, op=1;
    while(e && e!==sl[c]){ var cs=getComputedStyle(e); op*= +cs.opacity; if(cs.visibility==='hidden'||cs.display==='none') op=0; e=e.parentElement; }
    if(op<=0.05) return;
    /* притьмарений крок .steps — норма, якщо числа в ньому сховані (span.dg під
       плашкою). Помилка — коли видно хоч одну цифру, тобто саму відповідь */
    var cl=h.cloneNode(true);
    [].forEach.call(cl.querySelectorAll('.dg, .i'),function(x){x.remove();});
    if(/\\d/.test(cl.textContent) || h.querySelector('svg,img,canvas')) bad++;
  });
  if(bad) __peekBad.push({i:c+1,n:bad});
}
var __clipPx=[];
function __clip(sl,c){
  var bar=document.getElementById('bar'); if(!bar || !sl[c]) return;
  var lim=bar.getBoundingClientRect().top, worst=0;
  [].forEach.call(sl[c].querySelectorAll('*'),function(e){
    if(!e.offsetParent && getComputedStyle(e).position!=='fixed') return;
    /* лише зміст: власний текст, SVG, картинка, полотно. Декор (сяйво .glow на
       титулі — порожній напівпрозорий кружок) і невидиме не рахуємо */
    var tag=e.tagName.toLowerCase();
    var own=[].some.call(e.childNodes,function(n){return n.nodeType===3 && n.textContent.trim();});
    if(!own && tag!=='svg' && tag!=='img' && tag!=='canvas') return;
    var cs=getComputedStyle(e);
    if(+cs.opacity<0.5 || cs.visibility==='hidden') return;
    var r=e.getBoundingClientRect(); if(!r.height) return;
    if(r.bottom-lim>worst) worst=r.bottom-lim;
  });
  /* поріг 20 px — рядок тексту. Перевірка завищує на 10–12 px (шрифти у віртуальному
     часі), справжнє «під панеллю» на 1280×720 — від 30 px */
  if(worst>20) __clipPx[c]=Math.round(worst);
}
function __report(){
  var out=[], slides=__slides();
  var sheet=document.getElementById('sheet'), topic=document.getElementById('topic');
  var cs=getComputedStyle(sheet);
  var avail=window.innerHeight-(topic?topic.offsetHeight:0)
            -parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
  slides.forEach(function(s,i){
    var h=__maxH[i]||0;
    if(!h){                       /* до слайда прохід не дійшов — старий спосіб */
      slides.forEach(function(x){x.classList.remove('on')});
      s.classList.add('on');
      [].slice.call(s.querySelectorAll('.hide')).forEach(function(x){x.classList.add('on')});
      h=s.scrollHeight;
    }
    out.push({i:i+1,t:s.dataset.t||'',h:Math.round(h),k:h>avail?+(avail/h).toFixed(3):1,
              steps:__steps[i]||0});
  });

  /* «У зошит», а бірюзової рамки немає. Задача, яку учні пишуть (чип
     «самостійно у зошит» або «у зошит» + умова/таймер), має показати, ЩО саме
     записати: .nb / .nbw. 5-З № 430 і 7-І № 168 — без рамки. */
  var noNb=[], oralSolo=[];
  slides.forEach(function(s,i){
    var modes=[].map.call(s.querySelectorAll('.mode'),function(m){return m.textContent.toLowerCase()}).join(' ');
    /* легенда «як відповідаємо» з чипами — не задача: задача має умову або таймер */
    var task = (s.querySelector('.cond') || s.hasAttribute('data-timer')) && !s.querySelector('.nb-legend');
    var writes = task && (s.querySelector('.mode.solo') || /у зошит/.test(modes));
    if(!writes) return;
    if(!s.querySelector('.nb, .nbw')) noNb.push(i+1);
    /* Самостійна в зошит, а відповіді — у рамці «усно — не записуємо»: учень
       бачить дві протилежні вказівки (7-І № 172). */
    /* відповідь (.ans) — у рамці «усно»; підказка «перев себе» в oral — це нормально */
    if(s.querySelector('.mode.solo') && s.querySelector('.oral .ans, .orw .ans, .ans.oral'))
      oralSolo.push(i+1);
  });

  /* Рейка: етап має йти одним шматком. Пауза етап не рве. Двічі вроздріб —
     «Куточком … Задачі … Куточком» (5-З урок 37), «Множення … Навпаки … Множення». */
  var runs=[], prevCh=null;
  slides.forEach(function(s){
    var c=s.dataset.chapter; if(c) prevCh=c;
    if(!prevCh || /відпоч|пауз/i.test(prevCh)) return;
    if(!runs.length || runs[runs.length-1]!==prevCh) runs.push(prevCh);
  });
  var seen={}, splitCh=[];
  runs.forEach(function(c){ if(seen[c] && splitCh.indexOf(c)<0) splitCh.push(c); seen[c]=1; });

  /* Примітка «Як розвʼязувати / Згадаймо» у дрібному .lab — з останньої парти не
     видно (11 px на 1280×720). Для неї є .rem. */
  var smallHint=[];
  slides.forEach(function(s,i){
    [].forEach.call(s.querySelectorAll('.lab'),function(l){
      if(/^\\s*(як\\s+розв|згадаймо)/i.test(l.textContent)) { if(smallHint.indexOf(i+1)<0) smallHint.push(i+1); }
    });
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
    noNb:noNb, oralSolo:oralSolo, splitCh:splitCh, smallHint:smallHint,
    clip:__clipPx.map(function(px,i){return px?{i:i+1,px:px}:null}).filter(Boolean),
    peek:__peekBad,
    err:window.__errs,
    avail:Math.round(avail),
    slides:out,
    built:__early,
    timers:document.querySelectorAll('.timer').length,
    pick:document.querySelectorAll('.mode.pick').length,
    roster:document.querySelectorAll('.roster').length,
    oral:document.querySelectorAll('.box.oral,.tbl.oral,.fig.oral').length,
    nb:document.querySelectorAll('.box.nb,.tbl.nb,.fig.nb').length,
    overview:document.querySelectorAll('#overview .oc').length,
    slideCount:slides.length
  });
}
window.addEventListener('load',function(){setTimeout(__walk,700)});
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
           f"--window-size={w},{h}", "--virtual-time-budget=300000",
           "--allow-file-access-from-files", "--dump-dom", path.as_uri()]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        # Один дек, що завис у headless, раніше валив увесь прогін (21.10.2026, 7-І алг. 21).
        return None, "тайм-аут 120 с (перевірити окремо: --only)"
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
    ap.add_argument("--file", help="перевірити довільний файл (копію деку поза проєктом)")
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
    if args.file:
        decks = [Path(args.file).resolve()]
    if not decks:
        sys.exit("Не знайдено деків за цим фільтром.")

    bad = 0
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        for p in decks:
            inst = instrument(p, tmp)
            name = (p.relative_to(ROOT).as_posix() if p.is_relative_to(ROOT) else str(p))
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
                                 ("jump", "jumpBoxes"), ("sgn", "sgnBoxes"),
                                 ("hist", "histBoxes"),
                                 ("ocr", "ocrBoxes"), ("colmul", "colmulBoxes"), ("coldiv", "coldivBoxes"),
                                 ("packs", "packsBoxes"), ("pow", "powBoxes"), ("sqcube", "sqcubeBoxes"), ("tr180", "tr180Boxes"), ("trisos", "trisosBoxes"), ("trkind", "trkindBoxes"), ("qinsc", "qinscBoxes"), ("qcirc", "qcircBoxes"), ("shl", "shlBoxes"), ("rainbow", "rainbowBoxes"), ("fan", "fanBoxes"), ("dom", "domBoxes"), ("req", "reqBoxes"), ("sepia", "sepiaBoxes"), ("poster", "posterBoxes"), ("srch", "srchBoxes"), ("pult", "pultBoxes"), ("ppt", "pptBoxes"), ("flip", "flipBoxes")):
                    b = data.get("built") or data
                    if b[box] and b[key] < b[box]:
                        miss.append(f"{key}: {b[key]}/{b[box]}")
                if data.get("peek"):
                    lines.append("    ВІДПОВІДЬ ВИДНО ДО КРОКУ (нерозкритий .hide помітний на екрані): "
                                 + ", ".join(f"№{c['i']} ({c['n']})" for c in data["peek"]))
                    problem = True
                if data.get("clip"):
                    lines.append(f"    {w}×{h}: ПІД ПАНЕЛЛЮ після останнього кроку (учень не бачить): "
                                 + ", ".join(f"№{c['i']} на {c['px']} px" for c in data["clip"]))
                    problem = True
                if miss:
                    lines.append("    компоненти не побудувались: " + "; ".join(miss))
                    problem = True
                if data["noWho"]:
                    lines.append("    вправа у зошит без способу відповіді "
                                 "(.mode.want або .mode.pick): слайди "
                                 + ", ".join("№" + str(i) for i in data["noWho"]))
                    problem = True
                def слайди(xs):
                    return ", ".join("№" + str(i) for i in xs)
                if data.get("noNb"):
                    lines.append("    «у зошит», а бірюзової рамки (.nb) немає — учень не бачить, "
                                 "що саме записати: слайди " + слайди(data["noNb"]))
                    problem = True
                if data.get("oralSolo"):
                    lines.append("    «самостійно у зошит», а відповідь у рамці «усно — не "
                                 "записуємо»: слайди " + слайди(data["oralSolo"]))
                    problem = True
                if data.get("splitCh"):
                    lines.append("    етап у рейці розірваний (зʼявляється двічі вроздріб): "
                                 + ", ".join("«" + c + "»" for c in data["splitCh"])
                                 + " — переставити слайди або назвати етапи інакше")
                    problem = True
                if data.get("smallHint"):
                    lines.append("    примітка «Як розвʼязувати / Згадаймо» дрібним .lab — "
                                 "писати <p class=\"rem\">: слайди " + слайди(data["smallHint"]))
                    problem = True
                пустишка = "проведено разом з урок" in p.read_text(encoding="utf-8", errors="ignore")
                if not (data["pick"] or data["roster"]) and not пустишка:
                    lines.append("    немає завдання з випадковим номером "
                                 "(.mode.pick або .roster) — обовʼязкове в кожному уроці")
                    problem = True
                if data["overview"] != data["slideCount"]:
                    lines.append(f"    огляд: {data['overview']} карток "
                                 f"замість {data['slideCount']}")
                    problem = True
            print(("✗ " if problem else "✓ ") + name)
            бачено = set()
            for l in lines:
                # зміст (рамки, рейка, примітки) від розміру екрана не залежить — раз
                if not l.lstrip()[:1].isdigit():
                    if l in бачено:
                        continue
                    бачено.add(l)
                print(l)
            bad += problem
    print(f"\nПеревірено {len(decks)}; з проблемами: {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
