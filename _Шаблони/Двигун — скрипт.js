/* ═══════════════════════════════════════════════════════════════════════
   ДВИГУН ПРЕЗЕНТАЦІЇ ДЛЯ КЛАСУ — скрипт
   Єдине джерело. Правити тільки тут, далі:  python3 tools/update_decks.py
   Вбудовується в кожен дек: презентація має працювати як один файл,
   відкритий подвійним кліком, без сервера й без інтернету.

   Розмітка слайда, яку розуміє двигун:
     <section class="slide" data-t="Назва" data-chapter="Етап" data-timer="90">
     .hide            — показується по пробілу (звичайна поява)
     .hide.pop        — головна відповідь, пружинкою
     .hide.ink        — рядок розвʼязання, «пишеться» зліва направо
     .count[data-to]  — число, що набігає
     .steps > .st     — покрокове розвʼязання
     .fx + .fx-leg    — розбирання формули
     .numline[data-from][data-to][data-value][data-round]
     .coladd[data-a][data-b]
     .colsub[data-a][data-b]  — віднімання стовпчиком, крок = пробіл
     .quiz > button[data-ok]
     .roster
     .qr[data-url][data-code]
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
"use strict";

var D = document, W = window, root = D.documentElement;
function $(s,r){ return (r||D).querySelector(s); }
function $$(s,r){ return [].slice.call((r||D).querySelectorAll(s)); }
function el(t,c,h){ var e=D.createElement(t); if(c) e.className=c; if(h!=null) e.innerHTML=h; return e; }
function on(e,t,f,o){ e.addEventListener(t,f,o); }
function ls(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(err){ return null; } }
function lsDel(k){ try{ localStorage.removeItem(k); }catch(err){} }

var slides = $$('.slide');
if(!slides.length) return;
var sheet = $('#sheet'), bar = $('#bar'), topic = $('#topic');
var cur = 0, KEY = 'deck:' + location.pathname;

/* ─────────────────────────────────────────────────────────────────────
   0 · налаштування, які вчитель перемикає й вони запамʼятовуються
   ───────────────────────────────────────────────────────────────────── */
var PREFS = ['theme','fx','cards','bg','proj'];
PREFS.forEach(function(k){
  var v = ls('deckpref:' + k);
  if(v) root.setAttribute('data-' + k, v);
  else if(k === 'fx' && !root.hasAttribute('data-fx')) root.setAttribute('data-fx','slide');
});
function pref(k,v){
  if(v == null || v === ''){ root.removeAttribute('data-'+k); lsDel('deckpref:'+k); }
  else { root.setAttribute('data-'+k, v); ls('deckpref:'+k, v); }
  fit();
}

/* ─────────────────────────────────────────────────────────────────────
   A9 · автопідгін слайда під екран
   Доступну висоту рахуємо від вікна, а НЕ від #sheet: лист розтягується
   під вміст, і вимір від нього показував би 1px замість переповнення.
   ───────────────────────────────────────────────────────────────────── */
function availH(){
  var cs = getComputedStyle(sheet);
  return W.innerHeight
       - (topic ? topic.offsetHeight : 0)
       - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
}
function fit(){
  var s = slides[cur];
  if(!s) return;
  s.style.transform = '';
  var h = s.scrollHeight, a = availH();
  if(a > 0 && h > a + 1){
    var k = Math.max(0.45, a / h);
    s.style.transform = 'scale(' + k.toFixed(4) + ')';
  }
}
W.__deckFit = fit;                      /* для автоперевірки «чи влазить» */
var rt = null;
on(W,'resize',function(){ clearTimeout(rt); rt = setTimeout(fit,120); });
if(D.fonts && D.fonts.ready) D.fonts.ready.then(function(){ fit(); });
on(W,'load',fit);

/* ─────────────────────────────────────────────────────────────────────
   панель знизу: кнопки, яких у старих деках не було
   ───────────────────────────────────────────────────────────────────── */
var rail = $('#rail'), count = $('#count'), tip = $('#tip');
if(bar){
  if(!$('#fs',bar)){ var f=el('button'); f.id='fs'; f.type='button'; f.textContent='⛶'; bar.appendChild(f); }
  var extra = el('div','nav hide-sm');
  extra.innerHTML =
    '<button id="btnOv"  type="button" title="Огляд слайдів (O)" class="mini">▦</button>' +
    '<button id="btnInk" type="button" title="Малювати (D)"      class="mini">✎</button>' +
    '<button id="btnTh"  type="button" title="Тема (Y)"          class="mini">◐</button>' +
    '<button id="btnHelp" type="button" title="Клавіші (?)"      class="mini">?</button>';
  bar.insertBefore(extra, $('#fs',bar));
}

/* ─────────────────────────────────────────────────────────────────────
   B4 · рейка прогресу з етапами уроку
   ───────────────────────────────────────────────────────────────────── */
var chapters = [];
(function(){
  var last = null;
  slides.forEach(function(s,i){
    var c = s.dataset.chapter;
    if(c) last = c;
    s.__chapter = last;
    if(last && (!chapters.length || chapters[chapters.length-1].name !== last))
      chapters.push({ name:last, from:i, to:i });
    else if(chapters.length) chapters[chapters.length-1].to = i;
  });
  if(!chapters.length || chapters.length < 2 || !rail) return;
  rail.classList.add('chap');
  rail.innerHTML = '';
  chapters.forEach(function(ch){
    var n = ch.to - ch.from + 1;
    var d = el('div','ch');
    d.style.setProperty('--w', n);
    d.appendChild(el('div','cap', ch.name));
    var seg = el('div','seg');
    for(var i=0;i<n;i++) seg.appendChild(el('i'));
    d.appendChild(seg);
    ch.node = d; ch.cells = $$('i', seg);
    rail.appendChild(d);
  });
})();
var flatCells = [];
if(rail && !rail.classList.contains('chap')){
  rail.innerHTML = '';
  slides.forEach(function(){ rail.appendChild(el('i')); });
  flatCells = $$('i', rail);
}

/* ─────────────────────────────────────────────────────────────────────
   A10 · таймер 2.0 (смуга, ±1 хв, сигнал)
   ───────────────────────────────────────────────────────────────────── */
var ticking = null;

function placeSlot(s){
  /* Слот стає МІЖ умовою і відповідями — вимога «таймер не їде вниз». */
  var slot = $('.timerslot', s);
  if(!slot) slot = el('div','timerslot');
  if(slot.parentNode) slot.parentNode.removeChild(slot);
  var kids = [].slice.call(s.children), anchor = null, intro = null, introDone = false;
  for(var i=0;i<kids.length;i++){
    var k = kids[i];
    if(k.classList.contains('hide') || k.querySelector('.hide')){ anchor = k; break; }
    if(!introDone){
      if(/^H[1-6]$/.test(k.tagName) || k.classList.contains('modes') ||
         k.classList.contains('lede') || k.classList.contains('eyebrow')) intro = k;
      else introDone = true;
    }
  }
  if(!anchor) anchor = intro ? intro.nextSibling : null;
  s.insertBefore(slot, anchor);
  return slot;
}
slides.forEach(function(s){
  if(!s.dataset.timer) return;
  var total = parseInt(s.dataset.timer,10) || 60;
  var box = el('div','timer');
  box.innerHTML =
    '<div class="clock"><b class="m">0</b><i class="c">:</i><b class="s">00</b></div><p class="lab"></p>' +
    '<button type="button" class="go"></button>' +
    '<button type="button" class="less">\u22121 хв</button>' +
    '<button type="button" class="more">+1 хв</button>' +
    /* Смуга — не для скрінрідера: те саме число вже сказане годинником. */
    '<div class="bar" aria-hidden="true"><span class="fill"></span></div>';
  box.dataset.total = total; box.dataset.left = total; box.dataset.run = '0';
  placeSlot(s).appendChild(box);
});
var AC = null;
function audio(){
  var A = W.AudioContext || W.webkitAudioContext;
  if(!A) return null;
  if(!AC){ try{ AC = new A(); }catch(e){ return null; } }
  if(AC.state === 'suspended'){ try{ AC.resume(); }catch(e){} }
  return AC;
}
function beep(){
  if(ls('deckpref:mute') === '1') return;
  var a = audio(); if(!a) return;
  try{
    function tone(at, hz){
      var o = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o.frequency.value = hz; o.connect(g); g.connect(a.destination);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
      o.start(at); o.stop(at + 0.45);
    }
    var t0 = a.currentTime;
    tone(t0, 880); tone(t0 + 0.26, 660);      /* дві ноти — чути з іншого кінця класу */
  }catch(e){}
}
/* Поділки на смузі. Крок — хвилина, але не більш як 12 поділок: на завданні
   в пів години хвилинні риски злилися б у штрихування. Коротші за 2 хв
   завдання лишаємо без поділок — ділити там нічого. */
function segment(b){
  var bar = $('.bar', b); if(!bar) return;
  var total = +b.dataset.total, step = 60 * Math.ceil(total / 720);
  if(total < 120){ bar.classList.remove('seg'); return; }
  bar.style.setProperty('--seg', (100 * step / total).toFixed(3) + '%');
  bar.classList.add('seg');
}
function fmt(sec){ sec = Math.max(0,sec); return Math.floor(sec/60) + ':' + ('0'+(sec%60)).slice(-2); }
function setClock(b, sec){
  sec = Math.max(0, sec);
  $('.clock .m', b).textContent = Math.floor(sec/60);
  $('.clock .s', b).textContent = ('0'+(sec%60)).slice(-2);
}
function drawTimer(b, jump){
  var total = +b.dataset.total, left = +b.dataset.left, run = b.dataset.run === '1';
  setClock(b, left);
  /* Двокрапка блимає раз на секунду, поки таймер іде. Це головний сигнал
     «годинник працює»: смуга за секунду коротшає менш ніж на піксель, а
     блимання видно з будь-якої парти. */
  b.classList.toggle('run', run && left > 0);
  /* Заповнення повзе рівно (transition .95s linear), тож між секундами
     смуга не стоїть, а тече. jump — коли час стрибнув («±1 хв», «Ще раз»):
     тоді перехід на мить вимикаємо, щоб смуга не їхала назад через
     півекрана. */
  var fill = $('.bar .fill', b);
  if(jump) fill.style.transition = 'none';
  fill.style.width = (100 * Math.max(0, left) / total).toFixed(3) + '%';
  if(jump){
    void fill.offsetWidth;                       /* примусовий перерахунок */
    fill.style.transition = '';
  }
  b.classList.toggle('warn', left > 0 && left <= 30);
  b.classList.toggle('over', left === 0);
  $('.lab',b).textContent = left === 0 ? 'Час вийшов' : (run ? 'Працюємо' : 'на це завдання');
  $('.go',b).textContent  = left === 0 ? 'Ще раз'    : (run ? 'Пауза'    : 'Почати');
  /* Зрізати хвилину нема з чого, коли час уже вийшов. */
  var less = $('.less',b); if(less) less.disabled = left === 0;
}
function stopTick(){ if(ticking){ clearInterval(ticking); ticking = null; } }
function toggleTimer(b){
  if(b.dataset.run === '1'){ b.dataset.run='0'; stopTick(); drawTimer(b); return; }
  var restarted = false;
  if(+b.dataset.left === 0){
    b.dataset.left = b.dataset.total; b.classList.remove('ding');
    restarted = true;                            /* смугу доливаємо миттєво */
  }
  audio();                       /* розбудити звук, поки триває жест користувача */
  b.dataset.run = '1'; stopTick();
  ticking = setInterval(function(){
    var left = +b.dataset.left - 1;
    b.dataset.left = Math.max(0,left);
    if(left <= 0){ b.dataset.run='0'; stopTick(); b.classList.add('ding'); beep(); }
    drawTimer(b);
  },1000);
  drawTimer(b, restarted);
}
function resetTimer(s){
  var b = s && $('.timer',s); if(!b) return;
  b.dataset.left = b.dataset.total; b.dataset.run = '0';
  b.classList.remove('ding'); segment(b); drawTimer(b, true);
}
on(D,'click',function(e){
  var t = e.target.closest && e.target.closest('.timer .go, .timer .more, .timer .less');
  if(!t || t.disabled) return;
  e.stopPropagation();
  var b = t.parentNode;
  if(t.classList.contains('more')){
    b.dataset.total = +b.dataset.total + 60;
    b.dataset.left  = +b.dataset.left  + 60;
    b.classList.remove('over','ding'); segment(b); drawTimer(b, true); fit();
  } else if(t.classList.contains('less')){
    /* «−1 хв» — коли клас упорався швидше. Разом із рештою меншає й загальний
       час: інакше смуга показувала б частку від хвилин, яких уже немає.
       Коротше за хвилину таймер не робимо, а якщо зрізали все — це той самий
       кінець часу, що й природний, із сигналом. */
    var tot = Math.max(60, +b.dataset.total - 60);
    var lf  = Math.min(Math.max(0, +b.dataset.left - 60), tot);
    var was = b.dataset.run === '1';
    b.dataset.total = tot; b.dataset.left = lf;
    if(lf === 0 && was){ b.dataset.run = '0'; stopTick(); b.classList.add('ding'); beep(); }
    segment(b); drawTimer(b, true); fit();
  } else toggleTimer(b);
}, true);

/* ─────────────────────────────────────────────────────────────────────
   B7 · числа, що набігають
   ───────────────────────────────────────────────────────────────────── */
function spaceNum(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' '); }
function runCount(box){
  $$('.count', box).forEach(function(c){
    if(c.__ran) return; c.__ran = 1;
    var to = parseFloat(c.dataset.to); if(isNaN(to)) return;
    var t0 = performance.now(), dur = 820;
    (function step(now){
      var p = Math.min(1,(now-t0)/dur), e = 1 - Math.pow(1-p,3);
      c.textContent = spaceNum(Math.round(to*e));
      if(p < 1) requestAnimationFrame(step); else c.textContent = spaceNum(to);
    })(t0);
  });
}
$$('.count').forEach(function(c){ if(c.dataset.to && !c.textContent.trim()) c.textContent = '0'; });

/* ─────────────────────────────────────────────────────────────────────
   показ відповідей, лічильник кроків (A11), навігація, A1 переходи
   ───────────────────────────────────────────────────────────────────── */
function hiddenOf(i){ return $$('.hide:not(.on)', slides[i]); }
function shownOf(i){ return $$('.hide.on', slides[i]); }

function paint(){
  var s = slides[cur];
  if(rail && rail.classList.contains('chap')){
    chapters.forEach(function(ch){
      ch.node.classList.toggle('cur', cur >= ch.from && cur <= ch.to);
      ch.cells.forEach(function(c,j){
        var idx = ch.from + j;
        c.className = idx < cur ? 'done' : (idx === cur ? 'cur' : '');
      });
    });
  } else flatCells.forEach(function(c,i){
    c.className = i < cur ? 'done' : (i === cur ? 'cur' : '');
  });

  /* Лічильники «3 / 18» і «показано 2 з 5» прибрано 25.09.2026 (вчитель:
     «додаткові лічильники прибрати звідусіль»): позицію показує рейка слайдів,
     а що вже відкрито — видно на самому слайді. Розмітку в деках не чіпаємо —
     елементи просто сховані стилями. */
  if(topic){
    var ch = s.__chapter;
    var slot = $('.step-of', topic);
    if(ch){
      if(!slot){ slot = el('span','step-of'); slot.style.cssText='flex:none;color:var(--soft);font-size:clamp(9px,calc(.95*var(--u)),12px);letter-spacing:.14em;text-transform:uppercase;font-family:"Unbounded",sans-serif;font-weight:600'; topic.appendChild(slot); }
      slot.textContent = ch;
    } else if(slot) slot.textContent = '';
  }
  fit();
}

function applyState(i, revealAll){
  slides[cur].classList.remove('on');
  cur = i;
  var s = slides[cur];
  s.classList.add('on');
  $$('.hide', s).forEach(function(x){ x.classList.toggle('on', !!revealAll); });
  if(revealAll) runCount(s);
  resetTimer(s);
  syncSteps(s);
  paint();
}

function go(i, revealAll){
  if(i < 0 || i >= slides.length || i === cur) { if(i===cur){ paint(); } return; }
  lesAuto();
  stopTick(); resetTimer(slides[cur]);
  clearInk();
  var run = function(){ applyState(i, revealAll); };
  var fx = root.getAttribute('data-fx');
  if(fx && fx !== 'none' && D.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    D.startViewTransition(run);
  } else run();
  W.scrollTo(0,0);
  remember();
}

function next(){
  lesAuto();
  var h = hiddenOf(cur);
  if(h.length){
    h[0].classList.add('on');
    runCount(h[0]);
    syncSteps(slides[cur]);
    paint();
    return;
  }
  go(cur+1,false);
}
function prev(){
  var s = shownOf(cur);
  if(s.length){
    s[s.length-1].classList.remove('on');
    syncSteps(slides[cur]);
    paint();
    return;
  }
  go(cur-1,true);
}

/* ─────────────────────────────────────────────────────────────────────
   C1 · покрокове розвʼязання: підсвічує останній відкритий крок
   ───────────────────────────────────────────────────────────────────── */
function syncSteps(s){
  $$('.steps', s).forEach(function(list){
    var sts = $$('.st', list), lastOn = -1;
    sts.forEach(function(st,i){
      var open = !st.classList.contains('hide') || st.classList.contains('on');
      st.classList.toggle('on', open);
      if(open) lastOn = i;
    });
    sts.forEach(function(st,i){ st.classList.toggle('now', i === lastOn); });
  });
  $$('.colsub,.ordops,.frm,.sqdiag,.subst,.sgn', s).forEach(function(b){ if(b.__paint) b.__paint(); });
}

/* ─────────────────────────────────────────────────────────────────────
   A3 · адреса слайда й памʼять місця
   ───────────────────────────────────────────────────────────────────── */
function remember(){
  try{ history.replaceState(null,'','#'+(cur+1)); }catch(e){}
  ls(KEY, String(cur+1));
}
function startIndex(){
  var m = /^#(\d+)$/.exec(location.hash);
  if(m){ var i = +m[1]-1; if(i>=0 && i<slides.length) return {i:i, ask:false}; }
  var saved = parseInt(ls(KEY)||'',10);
  if(saved && saved > 1 && saved <= slides.length) return {i:0, ask:saved-1};
  return {i:0, ask:false};
}
function offerResume(i){
  var box = el('div'); box.id = 'resume';
  box.innerHTML = '<span>Минулого разу зупинились на слайді <b>'+(i+1)+'</b></span>' +
                  '<button type="button" id="resYes">Продовжити</button>' +
                  '<button type="button" id="resNo">З початку</button>';
  D.body.appendChild(box);
  requestAnimationFrame(function(){ box.classList.add('on'); });
  var hideIt = function(){ box.classList.remove('on'); setTimeout(function(){ box.remove(); },250); };
  on($('#resYes',box),'click',function(e){ e.stopPropagation(); hideIt(); go(i,false); });
  on($('#resNo',box),'click',function(e){ e.stopPropagation(); hideIt(); lsDel(KEY); });
  setTimeout(hideIt, 12000);
}
on(W,'hashchange',function(){
  var m = /^#(\d+)$/.exec(location.hash);
  if(m){ var i = +m[1]-1; if(i !== cur && i>=0 && i<slides.length) go(i,false); }
});

/* ─────────────────────────────────────────────────────────────────────
   A2 · огляд усіх слайдів
   ───────────────────────────────────────────────────────────────────── */
var ov = el('div'); ov.id = 'overview';
ov.innerHTML = '<div class="ohd"><h2>Усі слайди</h2>' +
  '<span style="color:var(--soft);font-size:14px">клік — перейти · <kbd>Esc</kbd> — закрити</span>' +
  '<span style="flex:1"></span><button type="button" id="ovClose">Закрити</button></div>' +
  '<div class="ogr"></div>';
D.body.appendChild(ov);
var ogr = $('.ogr', ov);
slides.forEach(function(s,i){
  var head = $('h1,h2', s);
  var title = s.dataset.t || (head ? head.textContent : 'Слайд ' + (i+1));
  var sub = '';
  var p = $('p:not(.eyebrow)', s);
  if(p) sub = p.textContent.replace(/\s+/g,' ').trim();
  var b = el('button','oc');
  b.type = 'button';
  b.innerHTML = '<span class="k"><span class="no"></span></span>' +
                '<span class="tt"></span><span class="sub"></span>';
  $('.no',b).textContent = (i+1) + ' / ' + slides.length;
  if(s.__chapter){ var t = el('span','ch', ''); t.textContent = s.__chapter; $('.k',b).appendChild(t); }
  $('.tt',b).textContent = title;
  $('.sub',b).textContent = sub;
  on(b,'click',function(e){ e.stopPropagation(); closeOv(); go(i,false); });
  ogr.appendChild(b);
});
var ovCards = $$('.oc', ogr);
function openOv(){
  ovCards.forEach(function(c,i){ c.setAttribute('aria-current', String(i===cur)); });
  ov.classList.add('on');
  var c = ovCards[cur]; if(c && c.scrollIntoView) c.scrollIntoView({block:'nearest'});
}
function closeOv(){ ov.classList.remove('on'); }
function toggleOv(){ ov.classList.contains('on') ? closeOv() : openOv(); }
on($('#ovClose',ov),'click',function(e){ e.stopPropagation(); closeOv(); });

/* ─────────────────────────────────────────────────────────────────────
   A5 · маркер і лазер
   ───────────────────────────────────────────────────────────────────── */
var cv = el('canvas'); cv.id = 'ink'; D.body.appendChild(cv);
var las = el('div'); las.id = 'laser'; D.body.appendChild(las);
var inkbar = el('div'); inkbar.id = 'inkbar';
inkbar.innerHTML =
  '<button type="button" class="sw" data-c="marker" aria-pressed="true" title="Червоний"></button>' +
  '<button type="button" class="sw" data-c="pen"    title="Синій"></button>' +
  '<button type="button" class="sw" data-c="check"  title="Зелений"></button>' +
  '<button type="button" data-a="laser" title="Лазер (L)">лазер</button>' +
  '<button type="button" data-a="clear" title="Стерти (C)">стерти</button>' +
  '<button type="button" data-a="off"   title="Вийти (Esc)">готово</button>';
D.body.appendChild(inkbar);

var ctx = cv.getContext('2d'), inkMode = 'off', inkCol = 'marker', drawing = false, strokes = [];
var lasPts = [], lasRaf = null, lastXY = null;
function cssVar(n){ return getComputedStyle(root).getPropertyValue('--'+n).trim() || '#D7263D'; }
function sizeInk(){
  var dpr = W.devicePixelRatio || 1;
  cv.width = Math.round(W.innerWidth*dpr); cv.height = Math.round(W.innerHeight*dpr);
  cv.style.width = W.innerWidth+'px'; cv.style.height = W.innerHeight+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0); redrawInk();
}
function redrawInk(){
  ctx.clearRect(0,0,W.innerWidth,W.innerHeight);
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.lineWidth=5;
  strokes.forEach(function(st){
    ctx.strokeStyle = cssVar(st.c); ctx.beginPath();
    st.p.forEach(function(pt,i){ i ? ctx.lineTo(pt[0],pt[1]) : ctx.moveTo(pt[0],pt[1]); });
    ctx.stroke();
  });
  drawLaser();
}
var LAS_MS = 700;
function drawLaser(){
  if(inkMode !== 'laser' || lasPts.length < 2) return;
  var now = performance.now();
  ctx.lineCap='round'; ctx.lineJoin='round';
  for(var i=1;i<lasPts.length;i++){
    var age = now - lasPts[i].t;
    if(age > LAS_MS) continue;
    var k = 1 - age/LAS_MS;
    ctx.globalAlpha = k * 0.85;
    ctx.lineWidth = 3 + 7*k;
    ctx.strokeStyle = cssVar('marker');
    ctx.beginPath();
    ctx.moveTo(lasPts[i-1].x, lasPts[i-1].y);
    ctx.lineTo(lasPts[i].x, lasPts[i].y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function lasLoop(){
  if(inkMode !== 'laser'){ lasRaf = null; return; }
  var now = performance.now();
  while(lasPts.length && now - lasPts[0].t > LAS_MS) lasPts.shift();
  redrawInk();
  lasRaf = requestAnimationFrame(lasLoop);
}
function clearInk(){ strokes = []; lasPts = []; if(ctx) redrawInk(); }
function setInk(mode){
  inkMode = mode;
  if(mode === 'laser'){
    /* цятку одразу ставимо туди, де курсор був востаннє, а не в куток */
    var p = lastXY || [W.innerWidth/2, W.innerHeight/2];
    las.style.left = p[0]+'px'; las.style.top = p[1]+'px';
    if(!lasRaf) lasRaf = requestAnimationFrame(lasLoop);
  } else {
    lasPts = [];
    if(lasRaf){ cancelAnimationFrame(lasRaf); lasRaf = null; }
    if(ctx) redrawInk();
  }
  cv.classList.toggle('on', mode !== 'off');
  cv.classList.toggle('laser', mode === 'laser');
  las.classList.toggle('on', mode === 'laser');
  inkbar.classList.toggle('on', mode !== 'off');
  $$('button[data-a="laser"]',inkbar).forEach(function(b){ b.setAttribute('aria-pressed', String(mode==='laser')); });
  var btn = $('#btnInk'); if(btn) btn.setAttribute('aria-pressed', String(mode !== 'off'));
  if(mode === 'off') las.classList.remove('on');
}
on(cv,'pointerdown',function(e){
  if(inkMode !== 'pen') return;
  drawing = true; cv.setPointerCapture(e.pointerId);
  strokes.push({ c:inkCol, p:[[e.clientX,e.clientY]] }); redrawInk();
});
on(cv,'pointermove',function(e){
  lastXY = [e.clientX, e.clientY];
  if(inkMode === 'laser'){
    las.style.left = e.clientX+'px'; las.style.top = e.clientY+'px';
    lasPts.push({x:e.clientX, y:e.clientY, t:performance.now()});
    redrawInk();          /* малюємо одразу, не чекаючи кадру: слід має бути
                             видно навіть там, де анімацію притишено */
    return;
  }
  if(!drawing) return;
  strokes[strokes.length-1].p.push([e.clientX,e.clientY]); redrawInk();
});
['pointerup','pointercancel'].forEach(function(t){ on(cv,t,function(){ drawing = false; }); });
on(inkbar,'click',function(e){
  var b = e.target.closest('button'); if(!b) return;
  e.stopPropagation();
  if(b.classList.contains('sw')){
    inkCol = b.dataset.c;
    $$('.sw',inkbar).forEach(function(x){ x.setAttribute('aria-pressed', String(x===b)); });
    if(inkMode !== 'pen') setInk('pen');
    return;
  }
  var a = b.dataset.a;
  if(a === 'clear') clearInk();
  else if(a === 'laser') setInk(inkMode === 'laser' ? 'pen' : 'laser');
  else setInk('off');
});
on(D,'pointermove',function(e){ if(inkMode === 'off') lastXY = [e.clientX, e.clientY]; }, true);
on(W,'resize',sizeInk);
sizeInk();

/* ─────────────────────────────────────────────────────────────────────
   A7 · довідка + A6 · друк + A8 · тема і проєктор
   ───────────────────────────────────────────────────────────────────── */
var help = el('dialog'); help.id = 'help';
help.innerHTML =
 '<div class="dhd"><h2>Клавіші й режими</h2><button type="button" data-close>Закрити</button></div>' +
 '<div class="dbd">' +
   '<div class="keys">' +
     '<span class="k"><kbd>пробіл</kbd> <kbd>→</kbd></span><span>показати наступне / далі</span>' +
     '<span class="k"><kbd>←</kbd></span><span>сховати останнє / назад</span>' +
     '<span class="k"><kbd>O</kbd></span><span>огляд усіх слайдів</span>' +
     '<span class="k"><kbd>T</kbd></span><span>таймер завдання: почати / пауза</span>' +
     '<span class="k"><kbd>U</kbd></span><span>таймер уроку (Shift+U — спочатку)</span>' +
     '<span class="k"><kbd>D</kbd></span><span>маркер — писати по слайду</span>' +
     '<span class="k"><kbd>L</kbd></span><span>лазерна цятка</span>' +
     '<span class="k"><kbd>C</kbd></span><span>стерти намальоване</span>' +
     '<span class="k"><kbd>B</kbd></span><span>затемнити екран — увага на вчителя</span>' +
     '<span class="k"><kbd>F</kbd></span><span>на весь екран</span>' +
     '<span class="k"><kbd>Y</kbd></span><span>тема: світла / темна / як у системі</span>' +
     '<span class="k"><kbd>P</kbd></span><span>режим проєктора (чорне на білому)</span>' +
     '<span class="k"><kbd>Home</kbd> <kbd>End</kbd></span><span>перший / останній слайд</span>' +
     '<span class="k"><kbd>?</kbd></span><span>ця довідка</span>' +
   '</div>' +
   '<div style="margin-top:18px;border-top:2px solid var(--edge);padding-top:14px">' +
     '<div style="font-family:Unbounded,sans-serif;font-weight:600;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);margin-bottom:10px">Друк і роздатка</div>' +
     '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
       '<button type="button" data-print="teacher">Друк з відповідями</button>' +
       '<button type="button" data-print="student">Друк для учнів</button>' +
     '</div>' +
     '<p style="font-size:14px;color:var(--soft);margin-top:9px">Кожен слайд ляже на свою сторінку А4. У варіанті для учнів місця відповідей лишаються порожніми.</p>' +
   '</div>' +
   '<div style="margin-top:18px;border-top:2px solid var(--edge);padding-top:14px;display:grid;gap:10px">' +
     '<label style="display:flex;align-items:center;gap:10px;font-size:15px"><input type="checkbox" id="optMute"> вимкнути сигнал таймера</label>' +
     '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
       '<span style="font-size:14px;color:var(--soft)">Фон:</span>' +
       '<button type="button" data-bg="">клітинка</button><button type="button" data-bg="dots">крапки</button>' +
       '<button type="button" data-bg="lines">лінійка</button><button type="button" data-bg="plain">чисто</button></div>' +
     '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
       '<span style="font-size:14px;color:var(--soft)">Перехід:</span>' +
       '<button type="button" data-fx="slide">зсув</button><button type="button" data-fx="lift">підйом</button>' +
       '<button type="button" data-fx="page">сторінка</button><button type="button" data-fx="fade">розчинення</button>' +
       '<button type="button" data-fx="none">без</button></div>' +
     '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
       '<span style="font-size:14px;color:var(--soft)">Картки:</span>' +
       '<button type="button" data-cards="">мʼякі</button><button type="button" data-cards="now">рамкою</button>' +
       '<button type="button" data-cards="tab">наліпкою</button></div>' +
   '</div>' +
 '</div>';
D.body.appendChild(help);
function markPrefBtns(){
  ['bg','fx','cards'].forEach(function(k){
    var v = root.getAttribute('data-'+k) || '';
    $$('[data-'+k+']', help).forEach(function(b){
      b.setAttribute('aria-pressed', String((b.getAttribute('data-'+k)||'') === v));
    });
  });
  var m = $('#optMute'); if(m) m.checked = ls('deckpref:mute') === '1';
}
on(help,'click',function(e){
  var b = e.target.closest('button'); if(!b) return;
  if(b.hasAttribute('data-close')){ help.close(); return; }
  if(b.hasAttribute('data-print')){
    root.setAttribute('data-print', b.getAttribute('data-print'));
    help.close(); setTimeout(function(){ W.print(); }, 60); return;
  }
  ['bg','fx','cards'].forEach(function(k){
    if(b.hasAttribute('data-'+k)){ pref(k, b.getAttribute('data-'+k)); markPrefBtns(); }
  });
});
on(help,'change',function(e){
  if(e.target.id === 'optMute') ls('deckpref:mute', e.target.checked ? '1' : '0');
});
function openHelp(){ markPrefBtns(); help.showModal(); }

var THEMES = ['','light','dark'];
function cycleTheme(){
  var i = THEMES.indexOf(root.getAttribute('data-theme') || '');
  pref('theme', THEMES[(i+1) % THEMES.length]);
}
function toggleProj(){ pref('proj', root.getAttribute('data-proj') === '1' ? '' : '1'); }

/* B · затемнення екрана */
var black = el('div');
black.style.cssText = 'position:fixed;inset:0;z-index:40;background:#000;display:none';
D.body.appendChild(black);
function toggleBlack(){ black.style.display = black.style.display === 'block' ? 'none' : 'block'; }
on(black,'click',function(e){ e.stopPropagation(); toggleBlack(); });

/* ─────────────────────────────────────────────────────────────────────
   C2 · розбирання формули
   ───────────────────────────────────────────────────────────────────── */
$$('.fx-leg').forEach(function(leg){
  var eq = leg.previousElementSibling;
  while(eq && !eq.classList.contains('fx')) eq = eq.previousElementSibling;
  if(!eq) return;
  function light(p){
    $$('mark', eq).forEach(function(m){ m.className = (p && m.dataset.p === p) ? ('p'+p) : ''; });
  }
  $$('button', leg).forEach(function(b){
    ['mouseenter','focus','click'].forEach(function(t){ on(b,t,function(e){ e.stopPropagation(); light(b.dataset.p); }); });
    on(b,'mouseleave',function(){ light(null); });
  });
});

/* ─────────────────────────────────────────────────────────────────────
   C3 · числова пряма, яку тягнуть
   ───────────────────────────────────────────────────────────────────── */
var SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(t,a){ var e = D.createElementNS(SVGNS,t); for(var k in a) e.setAttribute(k,a[k]); return e; }
$$('.numline').forEach(function(box){
  var L = +box.dataset.from, Rt = +box.dataset.to;
  var stp = +(box.dataset.step || Math.max(1, Math.round((Rt-L)/20)));
  var bigStep = +(box.dataset.big || stp*10);
  var round = +(box.dataset.round || 0);
  var val = +(box.dataset.value != null ? box.dataset.value : Math.round((L+Rt)/2));
  var X0 = 60, X1 = 740, Y = 96;
  var svg = svgEl('svg',{viewBox:'0 0 800 150', preserveAspectRatio:'xMidYMid meet', role:'img'});
  svg.setAttribute('aria-label','Числова пряма від '+L+' до '+Rt);
  var out = el('div','out');
  function x(v){ return X0 + (v-L)/(Rt-L)*(X1-X0); }
  for(var v = L; v <= Rt; v += stp){
    var big = (v % bigStep === 0);
    svg.appendChild(svgEl('line',{class: big?'tkb':'tk', x1:x(v), y1:Y-(big?15:8), x2:x(v), y2:Y+(big?15:8)}));
    if(big){ var tx = svgEl('text',{class:'b', x:x(v), y:Y+40, 'text-anchor':'middle'}); tx.textContent = v; svg.appendChild(tx); }
  }
  svg.appendChild(svgEl('line',{class:'ax', x1:X0-22, y1:Y, x2:X1+22, y2:Y}));
  var dot = svgEl('circle',{class:'dot', cx:x(val), cy:Y, r:11});
  var lbl = svgEl('text',{class:'b', x:x(val), y:Y-28, 'text-anchor':'middle'});
  svg.appendChild(dot); svg.appendChild(lbl);
  box.appendChild(svg); box.appendChild(out);
  function paintNl(){
    dot.setAttribute('cx', x(val)); lbl.setAttribute('x', x(val)); lbl.textContent = val;
    if(round > 1){
      var near = Math.round(val/round)*round;
      out.innerHTML = val + ' ≈ <b style="color:var(--check)">' + near + '</b>';
    } else out.textContent = val;
  }
  var down = false;
  function setFrom(e){
    var r = svg.getBoundingClientRect();
    var vx = (e.clientX - r.left) / r.width * 800;
    var v = L + (vx - X0)/(X1 - X0)*(Rt - L);
    val = Math.min(Rt, Math.max(L, Math.round(v)));
    paintNl();
  }
  on(svg,'pointerdown',function(e){ e.stopPropagation(); down = true; svg.setPointerCapture(e.pointerId); setFrom(e); });
  on(svg,'pointermove',function(e){ if(down) setFrom(e); });
  ['pointerup','pointercancel'].forEach(function(t){ on(svg,t,function(){ down = false; }); });
  paintNl();
});

/* ─────────────────────────────────────────────────────────────────────
   C4 · додавання стовпчиком із переносами по кроках
   ───────────────────────────────────────────────────────────────────── */
$$('.coladd').forEach(function(box){
  var a = String(box.dataset.a||''), b = String(box.dataset.b||'');
  var n = Math.max(a.length, b.length);
  var A = a.padStart(n,' '), B = b.padStart(n,' ');
  var sum = String(+a + +b), W_ = Math.max(n, sum.length);
  A = A.padStart(W_,' '); B = B.padStart(W_,' ');
  var S = sum.padStart(W_,' ');

  /* кроки справа наліво: цифра результату і чи є перенос далі */
  var steps = [], carry = 0, names = ['одиниці','десятки','сотні','тисячі','десятки тисяч','сотні тисяч'];
  for(var k = 0; k < W_; k++){
    var da = +(A[W_-1-k].trim() || 0), db = +(B[W_-1-k].trim() || 0);
    var t = da + db + carry;
    var digit = t % 10, nc = t >= 10 ? 1 : 0;
    var txt = (names[k] || ('розряд '+(k+1))) + ': ' + da + ' + ' + db +
              (carry ? ' + ' + carry : '') + ' = ' + t +
              (nc ? '. Пишемо ' + digit + ', ' + nc + ' — у памʼять.' : '. Переносу немає.');
    steps.push({ col:k, digit:digit, carry:nc, txt:txt });
    carry = nc;
  }
  if(carry) steps[steps.length-1].txt = steps[steps.length-1].txt.replace(/\.$/,'') + '';

  var tb = el('table','cl');
  function row(cls){ var r = el('tr', cls); tb.appendChild(r); return r; }
  var rc = row('c'), r1 = row(''), r2 = row('r'), r3 = row('');
  rc.appendChild(el('td'));                       /* під знак «+» */
  for(var i=0;i<W_;i++) rc.appendChild(el('td'));
  r1.appendChild(el('td','op'));
  for(i=0;i<W_;i++){ var td = el('td'); td.textContent = A[i].trim(); td.dataset.col = W_-1-i; r1.appendChild(td); }
  var opd = el('td','op'); opd.textContent = '+'; r2.appendChild(opd);
  for(i=0;i<W_;i++){ var td2 = el('td','d'); td2.textContent = B[i].trim(); td2.dataset.col = W_-1-i; r2.appendChild(td2); }
  r3.appendChild(el('td','op'));
  for(i=0;i<W_;i++){ var td3 = el('td','blank'); td3.textContent = S[i].trim(); td3.dataset.res = W_-1-i; r3.appendChild(td3); }

  var say = el('div','say');
  var ctr = el('div');
  ctr.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap';
  ctr.innerHTML = '<button type="button" data-a="go">Наступний розряд</button>' +
                  '<button type="button" data-a="rst">Спочатку</button>';
  box.appendChild(tb); box.appendChild(say); box.appendChild(ctr);

  var at = 0;
  function reset(){
    at = 0; say.textContent = '';
    $$('td[data-col]',tb).forEach(function(t){ t.classList.remove('hi'); });
    $$('td[data-res]',tb).forEach(function(t){ t.classList.add('blank'); });
    $$('tr.c td',tb).forEach(function(t){ t.textContent=''; t.classList.remove('on'); });
    fit();
  }
  function step(){
    if(at >= steps.length) return;
    var s = steps[at];
    $$('td[data-col]',tb).forEach(function(t){ t.classList.toggle('hi', +t.dataset.col === s.col); });
    var res = $('td[data-res="'+s.col+'"]',tb); if(res) res.classList.remove('blank');
    if(s.carry){
      var cCell = rc.children[W_ - (s.col+1)];   /* +1 зсув під «+», ще +1 у наступний розряд */
      if(cCell){ cCell.textContent = '1'; cCell.classList.add('on'); }
    }
    say.textContent = s.txt;
    at++;
    if(at >= steps.length){
      var extra = $('td[data-res="'+W_+'"]',tb);
      if(extra) extra.classList.remove('blank');
    }
    fit();
  }
  on(ctr,'click',function(e){
    var b2 = e.target.closest('button'); if(!b2) return;
    e.stopPropagation();
    b2.dataset.a === 'go' ? step() : reset();
  });
  reset();
});

/* ─────────────────────────────────────────────────────────────────────
   C4b · віднімання стовпчиком: кожна цифра — окремий крок по пробілу
   <div class="colsub" data-a="381064" data-b="27569"></div>
   Кроки — це .hide-рядки журналу, тож їх гортає звичайний пробіл/←,
   а стан стовпчика малюється з того, скільки рядків уже відкрито.
   Позика — окремий крок перед відніманням: спершу «звідки взяли»,
   потім «що від чого віднімаємо». data-check="0" — без перевірки.
   ───────────────────────────────────────────────────────────────────── */
$$('.colsub').forEach(function(box){
  var a = String(box.dataset.a||'').replace(/\D/g,''), b = String(box.dataset.b||'').replace(/\D/g,'');
  if(!a || !b || +a < +b) return;
  var n = a.length, R = String(+a - +b);
  var NOM = ['Одиниці','Десятки','Сотні','Тисячі','Десятки тисяч','Сотні тисяч','Мільйони','Десятки мільйонів'];
  var ONE = ['1 одиницю','1 десяток','1 сотню','1 тисячу','1 десяток тисяч','1 сотню тисяч','1 мільйон','1 десяток мільйонів'];
  var TEN = ['10 одиниць','10 десятків','10 сотень','10 тисяч','10 десятків тисяч','10 сотень тисяч','10 мільйонів'];
  var INS = ['одиницями','десятками','сотнями','тисячами','десятками тисяч','сотнями тисяч','мільйонами','десятками мільйонів'];
  var LOC = ['в одиницях','у десятках','у сотнях','у тисячах','у десятках тисяч','у сотнях тисяч','у мільйонах','у десятках мільйонів'];
  function nm(k,arr){ return arr[k] || ('розряд ' + (k+1)); }
  function fmt(s){ return String(s).replace(/\B(?=(\d{3})+(?!\d))/g,' '); }

  var A = [], B = [];                     /* індекс = розряд справа, 0 — одиниці */
  for(var k=0;k<n;k++){ A[k] = +a[n-1-k]; B[k] = k < b.length ? +b[b.length-1-k] : null; }
  var w = A.slice(), res = [], snaps = [], log = [];
  function snap(hi, lend, sh, lg){
    snaps.push({ w:w.slice(), res:res.slice(), hi:hi, lend:lend||[] });
    log.push({ sh:sh, lg:lg });
  }
  snap(-1, [], 'Записали розряд під розрядом',
    'Більше число — зверху. Одиниці пишемо під одиницями, десятки під десятками і так далі. ' +
    'Віднімаємо справа наліво: починаємо з одиниць.');

  for(k=0;k<n;k++){
    var y = B[k] == null ? 0 : B[k], was = w[k] !== A[k];
    if(w[k] < y){
      var j = k+1; while(w[j] === 0) j++;
      var lg = nm(k,NOM) + ': зверху ' + w[k] + ', знизу ' + y + '. З ' + w[k] + ' відняти ' + y +
               ' не можна — зверху менше. Позичаємо в сусіда зліва. ';
      if(j > k+1){
        lg += 'Але ' + LOC[k+1] + ' — 0, позичати нічого' +
              (j > k+2 ? ', і далі теж нулі' : '') + '. Ідемо лівіше, поки не знайдемо не нуль: ' +
              LOC[j] + ' є ' + w[j] + '. ';
      }
      var lend = [];
      for(var t=j; t>k; t--){
        lend.push(t);
        lg += 'Беремо ' + nm(t,ONE) + ' = ' + nm(t-1,TEN) + ': ' + LOC[t] + ' ' + w[t] + ' → ' + (w[t]-1) +
              ', ' + LOC[t-1] + ' ' + w[t-1] + ' → ' + (w[t-1]+10) + '. ';
        w[t] -= 1; w[t-1] += 10;
      }
      if(j > k+1) lg += 'Бачиш: кожен нуль спершу став 10, а потім віддав 1 праворуч — тому він стає 9. ';
      lg += 'У зошиті ставимо крапку над цифрою, у якої позичили.';
      snap(k, lend, nm(k,NOM) + ': ' + (w[k]-10) + ' − ' + y + ' не можна → позичаємо', lg);
    }
    var d = w[k] - y, lead = k >= R.length;
    res[k] = lead ? null : d;
    var sh = nm(k,NOM) + ': ' + w[k] + ' − ' + y + ' = ' + d;
    var txt = nm(k,NOM) + ': ';
    if(w[k] >= 10) txt += 'після позики зверху ' + w[k] + ', ';
    else if(was) txt += 'тут було ' + A[k] + ', але звідси позичили — лишилось ' + w[k] + '; ';
    else txt += 'зверху ' + w[k] + ', ';
    txt += B[k] == null ? 'знизу цифри немає — віднімаємо 0. ' : ('знизу ' + y + '. ');
    txt += w[k] + ' − ' + y + ' = ' + d + '. ';
    txt += lead ? 'Це найлівіша цифра, і вийшов 0 — нуль на початку числа не пишемо.'
                : 'Пишемо ' + d + ' під ' + nm(k,INS) + '.';
    if(lead) sh += ' — не пишемо';
    snap(k, [], sh, txt);
  }
  if(box.dataset.check !== '0'){
    snap(-1, [], 'Перевірка: ' + fmt(R) + ' + ' + fmt(b) + ' = ' + fmt(a) + ' ✓',
      'Відповідь: ' + fmt(R) + '. Перевіряємо додаванням: різниця + відʼємник = зменшуване. ' +
      fmt(R) + ' + ' + fmt(b) + ' = ' + fmt(+R + +b) + ' — збіглося з тим, від чого віднімали. Правильно!');
  }

  /* таблиця: рядок позик, зменшуване, відʼємник, різниця */
  var tb = el('table','cl');
  function row(cls){ var r = el('tr', cls); tb.appendChild(r); return r; }
  var rw = row('w'), r1 = row(''), r2 = row(''), r3 = row('r');
  var cells = { w:[], a:[], b:[], r:[] };
  [rw,r1,r2,r3].forEach(function(r,i){
    var op = el('td','op'); if(i === 1){ op.textContent = '−'; op.rowSpan = 2; r.appendChild(op); }
    else if(i !== 2) r.appendChild(op);
  });
  for(var i=n-1;i>=0;i--){
    var cw = el('td'), ca = el('td'), cb = el('td','d'), cr = el('td','d');
    ca.textContent = A[i]; cb.textContent = B[i] == null ? '' : B[i];
    cells.w[i]=cw; cells.a[i]=ca; cells.b[i]=cb; cells.r[i]=cr;
    rw.appendChild(cw); r1.appendChild(ca); r2.appendChild(cb); r3.appendChild(cr);
  }
  /* лінія лише під цифрами відповіді й відʼємника — як у зошиті */
  var say = el('div','say');
  var ol = el('ol','cs-log');
  log.forEach(function(L,i){ var li = el('li', i ? 'hide' : '', L.sh); ol.appendChild(li); });
  var left = el('div','cs-l'); left.appendChild(tb); left.appendChild(say);
  box.appendChild(left); box.appendChild(ol);

  box.__paint = function(){
    var lis = $$('li', ol), shown = 0;
    lis.forEach(function(li,i){ if(!i || li.classList.contains('on')) shown = i+1; });
    var s = snaps[shown-1];
    lis.forEach(function(li,i){ li.classList.toggle('now', i === shown-1); li.classList.toggle('past', i < shown-1); });
    for(var k=0;k<n;k++){
      var ch = s.w[k] !== A[k];
      cells.w[k].textContent = ch ? s.w[k] : '';
      cells.a[k].classList.toggle('x', ch);
      cells.r[k].textContent = s.res[k] == null ? '' : s.res[k];
      [cells.a[k],cells.b[k],cells.r[k],cells.w[k]].forEach(function(c){
        c.classList.toggle('hi', k === s.hi);
        c.classList.toggle('lend', s.lend.indexOf(k) >= 0);
      });
    }
    say.textContent = log[shown-1].lg.replace(/ ([−=→+]) /g,'\u00a0$1\u00a0');
    fit();
  };
  box.__paint();
});

/* ─────────────────────────────────────────────────────────────────────
   C5 · вибір відповіді
   ───────────────────────────────────────────────────────────────────── */
$$('.quiz').forEach(function(q){
  var say = q.nextElementSibling && q.nextElementSibling.classList.contains('quiz-say')
          ? q.nextElementSibling : null;
  $$('button',q).forEach(function(b){
    on(b,'click',function(e){
      e.stopPropagation();
      var ok = b.dataset.ok === '1';
      b.classList.remove('ok','no'); void b.offsetWidth;
      b.classList.add(ok ? 'ok' : 'no');
      if(say) say.textContent = b.dataset.why || (ok ? 'Правильно.' : 'Ні, спробуймо ще.');
      if(ok) $$('button',q).forEach(function(x){ x.disabled = true; });
      fit();
    });
  });
});

/* ─────────────────────────────────────────────────────────────────────
   Чип «випадковий номер» — кнопка просто в смужці «як відповідаємо».
   Діапазон: data-to на чипі → data-class-size на <html> → 30.
   У межах одного кола номер не повторюється.
   ───────────────────────────────────────────────────────────────────── */
var pickPools = {};
$$('.mode.pick').forEach(function(chip){
  var from = parseInt(chip.dataset.from || '1', 10);
  var to   = parseInt(chip.dataset.to || root.dataset.classSize || '30', 10);
  if(!(to >= from)){ from = 1; to = 30; }
  var key = from + '-' + to, busy = false;
  var slot = el('b','n','?');
  chip.appendChild(slot);
  chip.setAttribute('role','button');
  chip.setAttribute('tabindex','0');
  chip.setAttribute('aria-label','Витягнути номер від ' + from + ' до ' + to);
  chip.title = 'Натисни — випаде номер від ' + from + ' до ' + to;

  function roll(){
    if(busy) return;
    busy = true;
    if(!pickPools[key] || !pickPools[key].length){
      pickPools[key] = [];
      for(var n = from; n <= to; n++) pickPools[key].push(n);
    }
    var pool = pickPools[key], k = 0, spins = 16;
    chip.classList.add('spin'); chip.classList.remove('done');
    var t = setInterval(function(){
      slot.textContent = from + Math.floor(Math.random() * (to - from + 1));
      if(++k >= spins){
        clearInterval(t);
        chip.classList.remove('spin');
        slot.textContent = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        chip.classList.add('done');
        busy = false;
      }
    }, 55);
  }
  on(chip,'click',function(e){ e.stopPropagation(); roll(); });
  on(chip,'keydown',function(e){
    if(e.code === 'Space' || e.code === 'Enter'){ e.preventDefault(); e.stopPropagation(); roll(); }
  });
});

/* ─────────────────────────────────────────────────────────────────────
   C7 · хто відповідає — випадковий номер за журналом, від N до M.
   Саме номер, а не прізвище: дек публікується на сайті, персональних
   даних у ньому бути не може.
   ───────────────────────────────────────────────────────────────────── */
$$('.roster').forEach(function(box){
  var from = parseInt(box.dataset.from || '1', 10);
  var to   = parseInt(box.dataset.to || root.dataset.classSize || '30', 10);
  if(!(to >= from)) { from = 1; to = 30; }

  var win = el('div','win'); win.textContent = '?';
  var go2 = el('button'); go2.type = 'button'; go2.textContent = 'Витягнути';
  var again = el('button'); again.type = 'button'; again.textContent = 'Почати коло';
  box.appendChild(win); box.appendChild(go2); box.appendChild(again);

  var all = [], pool = [];
  for(var n = from; n <= to; n++) all.push(n);
  function fresh(){ pool = all.slice(); }
  /* Лічильник «ще не питали» прибрано 25.09.2026 (вчитель: «дублюючий»):
     скільки номерів лишилось у колі, на уроці не потрібно — важливий сам номер. */
  function say(){}
  on(go2,'click',function(e){
    e.stopPropagation();
    if(!pool.length) fresh();
    var k = 0, spins = 14;
    box.classList.add('spin');
    var t = setInterval(function(){
      win.textContent = '№ ' + all[Math.floor(Math.random()*all.length)];
      if(++k >= spins){
        clearInterval(t); box.classList.remove('spin');
        win.textContent = '№ ' + pool.splice(Math.floor(Math.random()*pool.length),1)[0];
        say();
      }
    },60);
  });
  on(again,'click',function(e){ e.stopPropagation(); fresh(); win.textContent = '?'; });
  fresh();
});

/* ─────────────────────────────────────────────────────────────────────
   C9 · QR-код (байтовий режим, рівень M, версії 1–10)
   Пишемо самі: жодної бібліотеки, жодного інтернету — дек лишається
   одним файлом. Побудова за ISO/IEC 18004.
   ───────────────────────────────────────────────────────────────────── */
function qrMatrix(text){
  /* ── таблиці версій, рівень M ── */
  var DATA_CW = [16,28,44,64,86,108,124,154,182,216];          /* даних, байт */
  var EC_PER  = [10,16,26,18,24,16,18,22,22,26];               /* корекції на блок */
  var BLOCKS  = [[1,0],[1,0],[1,0],[2,0],[2,0],[4,0],[4,0],[2,2],[3,2],[4,1]];
  var ALIGN   = [[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];

  /* ── байти вмісту (UTF-8) ── */
  var bytes = [];
  for(var i=0;i<text.length;i++){
    var c = text.charCodeAt(i);
    if(c < 0x80) bytes.push(c);
    else if(c < 0x800){ bytes.push(0xC0|(c>>6), 0x80|(c&63)); }
    else { bytes.push(0xE0|(c>>12), 0x80|((c>>6)&63), 0x80|(c&63)); }
  }
  /* ── версія ── */
  var ver = -1;
  for(i=0;i<10;i++){
    var lenBits = (i+1) < 10 ? 8 : 16;
    if(4 + lenBits + bytes.length*8 <= DATA_CW[i]*8){ ver = i+1; break; }
  }
  if(ver < 0) return null;
  var vi = ver-1, size = 17 + 4*ver, totalData = DATA_CW[vi];

  /* ── бітовий потік ── */
  var bits = [];
  function put(val,len){ for(var b=len-1;b>=0;b--) bits.push((val>>b)&1); }
  put(4,4);
  put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach(function(b){ put(b,8); });
  var cap = totalData*8;
  for(i=0;i<4 && bits.length<cap;i++) bits.push(0);
  while(bits.length % 8) bits.push(0);
  var data = [];
  for(i=0;i<bits.length;i+=8){
    var v = 0; for(var j=0;j<8;j++) v = (v<<1)|bits[i+j];
    data.push(v);
  }
  var pad = [0xEC,0x11], pi = 0;
  while(data.length < totalData) data.push(pad[pi++ % 2]);

  /* ── GF(256) ── */
  var EXP = new Array(512), LOG = new Array(256), x = 1;
  for(i=0;i<255;i++){ EXP[i]=x; LOG[x]=i; x<<=1; if(x & 0x100) x ^= 0x11D; }
  for(i=255;i<512;i++) EXP[i] = EXP[i-255];
  function mul(a,b){ return (a===0||b===0) ? 0 : EXP[LOG[a]+LOG[b]]; }
  function genPoly(n){
    var g = [1];
    for(var k=0;k<n;k++){
      var ng = new Array(g.length+1).fill(0);
      for(var m=0;m<g.length;m++){ ng[m] ^= g[m]; ng[m+1] ^= mul(g[m], EXP[k]); }
      g = ng;
    }
    return g;
  }
  function ecFor(block,n){
    var g = genPoly(n), rem = block.concat(new Array(n).fill(0));
    for(var m=0;m<block.length;m++){
      var f = rem[m]; if(!f) continue;
      for(var k=0;k<g.length;k++) rem[m+k] ^= mul(g[k], f);
    }
    return rem.slice(block.length);
  }

  /* ── блоки ── */
  var b1 = BLOCKS[vi][0], b2 = BLOCKS[vi][1], nb = b1+b2;
  var short = Math.floor(totalData/nb);
  var dBlocks = [], eBlocks = [], at = 0;
  for(i=0;i<nb;i++){
    var len = short + (i >= b1 ? 1 : 0);
    var blk = data.slice(at, at+len); at += len;
    dBlocks.push(blk); eBlocks.push(ecFor(blk, EC_PER[vi]));
  }
  var out = [], maxD = Math.max.apply(null, dBlocks.map(function(b){ return b.length; }));
  for(i=0;i<maxD;i++) for(j=0;j<nb;j++) if(i < dBlocks[j].length) out.push(dBlocks[j][i]);
  for(i=0;i<EC_PER[vi];i++) for(j=0;j<nb;j++) out.push(eBlocks[j][i]);

  /* ── полотно ── */
  var m = [], res = [];
  for(i=0;i<size;i++){ m.push(new Array(size).fill(0)); res.push(new Array(size).fill(0)); }
  function setF(r,c,v){ if(r<0||c<0||r>=size||c>=size) return; m[r][c]=v; res[r][c]=1; }
  function finder(r,c){
    for(var dr=-1;dr<=7;dr++) for(var dc=-1;dc<=7;dc++){
      var rr=r+dr, cc=c+dc;
      if(rr<0||cc<0||rr>=size||cc>=size) continue;
      var inb = dr>=0&&dr<=6&&dc>=0&&dc<=6;
      var dark = inb && (dr===0||dr===6||dc===0||dc===6||(dr>=2&&dr<=4&&dc>=2&&dc<=4));
      setF(rr,cc, dark?1:0);
    }
  }
  finder(0,0); finder(0,size-7); finder(size-7,0);
  for(i=8;i<size-8;i++){ setF(6,i,(i%2===0)?1:0); setF(i,6,(i%2===0)?1:0); }
  var ac = ALIGN[vi];
  for(i=0;i<ac.length;i++) for(j=0;j<ac.length;j++){
    var ar=ac[i], acl=ac[j];
    if((ar<=7&&acl<=7)||(ar<=7&&acl>=size-8)||(ar>=size-8&&acl<=7)) continue;
    for(var dr2=-2;dr2<=2;dr2++) for(var dc2=-2;dc2<=2;dc2++){
      var dark2 = Math.max(Math.abs(dr2),Math.abs(dc2)) !== 1;
      setF(ar+dr2, acl+dc2, dark2?1:0);
    }
  }
  for(i=0;i<9;i++){ if(i!==6){ setF(8,i,0); setF(i,8,0); } }
  for(i=0;i<8;i++) setF(8,size-1-i,0);                /* другий примірник, рядок 8 */
  for(i=0;i<7;i++) setF(size-1-i,8,0);                /* другий примірник, стовпець 8 */
  setF(size-8,8,1);                                   /* завжди темний модуль */
  if(ver >= 7) for(i=0;i<18;i++){
    var r3 = Math.floor(i/3), c3 = i%3;
    setF(size-11+c3, r3, 0); setF(r3, size-11+c3, 0);
  }

  /* ── розкладання даних зиґзаґом ── */
  var bitIdx = 0, dir = -1, col = size-1;
  function bitAt(k){ return (k>>3) < out.length ? (out[k>>3] >> (7-(k&7))) & 1 : 0; }
  var row = size-1;
  while(col > 0){
    if(col === 6) col--;
    for(var n2=0;n2<size;n2++){
      for(var s2=0;s2<2;s2++){
        var cc2 = col - s2;
        if(res[row][cc2]) continue;
        m[row][cc2] = bitAt(bitIdx++);
      }
      var nr = row + dir;
      if(nr < 0 || nr >= size) break;
      row = nr;
    }
    dir = -dir; col -= 2;
  }

  /* ── маски й штрафи ── */
  function maskFn(k,r,c){
    switch(k){
      case 0: return (r+c)%2===0;
      case 1: return r%2===0;
      case 2: return c%3===0;
      case 3: return (r+c)%3===0;
      case 4: return (Math.floor(r/2)+Math.floor(c/3))%2===0;
      case 5: return ((r*c)%2 + (r*c)%3)===0;
      case 6: return (((r*c)%2 + (r*c)%3)%2)===0;
      default:return (((r+c)%2 + (r*c)%3)%2)===0;
    }
  }
  function penalty(g){
    var p = 0, n3 = size, i2, j2, run, prev, dark = 0;
    for(i2=0;i2<n3;i2++){
      run=1; prev=g[i2][0];
      for(j2=1;j2<n3;j2++){ if(g[i2][j2]===prev) run++; else { if(run>=5) p += 3+(run-5); run=1; prev=g[i2][j2]; } }
      if(run>=5) p += 3+(run-5);
      run=1; prev=g[0][i2];
      for(j2=1;j2<n3;j2++){ if(g[j2][i2]===prev) run++; else { if(run>=5) p += 3+(run-5); run=1; prev=g[j2][i2]; } }
      if(run>=5) p += 3+(run-5);
    }
    for(i2=0;i2<n3-1;i2++) for(j2=0;j2<n3-1;j2++){
      var s3 = g[i2][j2]+g[i2][j2+1]+g[i2+1][j2]+g[i2+1][j2+1];
      if(s3===0||s3===4) p += 3;
    }
    var pat1 = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
    function seq(arr,st,pt){
      for(var k2=0;k2<11;k2++) if(arr[st+k2] !== pt[k2]) return false;
      return true;
    }
    for(i2=0;i2<n3;i2++){
      var rowA = g[i2], colA = [];
      for(j2=0;j2<n3;j2++) colA.push(g[j2][i2]);
      for(j2=0;j2+11<=n3;j2++){
        if(seq(rowA,j2,pat1)||seq(rowA,j2,pat2)) p += 40;
        if(seq(colA,j2,pat1)||seq(colA,j2,pat2)) p += 40;
      }
    }
    for(i2=0;i2<n3;i2++) for(j2=0;j2<n3;j2++) dark += g[i2][j2];
    p += Math.floor(Math.abs(dark*100/(n3*n3) - 50)/5) * 10;
    return p;
  }
  function bitLen(v){ var n=0; while(v){ n++; v >>>= 1; } return n; }
  function bch(v, poly, deg){
    var d = v << deg, pl = bitLen(poly);
    while(bitLen(d) >= pl) d ^= poly << (bitLen(d) - pl);
    return d;
  }
  function formatBits(mask){
    var v = (0x00 << 3) | mask;                       /* рівень M = 00 */
    return ((v << 10) | bch(v, 0x537, 10)) ^ 0x5412;
  }
  function versionBits(v){ return (v << 12) | bch(v, 0x1F25, 12); }

  var best = null, bestP = Infinity, bestMask = 0;
  for(var k3=0;k3<8;k3++){
    var g2 = [];
    for(i=0;i<size;i++){
      g2.push([]);
      for(j=0;j<size;j++) g2[i].push(res[i][j] ? m[i][j] : (m[i][j] ^ (maskFn(k3,i,j)?1:0)));
    }
    /* формат — щоб штраф рахувався на готовому коді */
    var fb = formatBits(k3);
    for(i=0;i<15;i++){
      var bit = (fb >> i) & 1;
      /* примірник біля лівого верхнього шукача:
         біти 0–5 униз по стовпцю 8, біти 9–14 — уліво по рядку 8 */
      if(i < 6)        g2[i][8]    = bit;
      else if(i === 6) g2[7][8]    = bit;
      else if(i === 7) g2[8][8]    = bit;
      else if(i === 8) g2[8][7]    = bit;
      else             g2[8][14-i] = bit;
      /* другий примірник: біти 0–7 уліво по рядку 8 від правого краю,
         біти 8–14 — угору по стовпцю 8 від нижнього краю */
      if(i < 8) g2[8][size-1-i]  = bit;
      else      g2[size-15+i][8] = bit;
    }
    g2[size-8][8] = 1;
    if(ver >= 7){
      var vb = versionBits(ver);
      for(i=0;i<18;i++){
        var b3 = (vb >> i) & 1, r4 = Math.floor(i/3), c4 = i%3;
        g2[size-11+c4][r4] = b3; g2[r4][size-11+c4] = b3;
      }
    }
    var p2 = penalty(g2);
    if(p2 < bestP){ bestP = p2; best = g2; bestMask = k3; }
  }
  return best;
}
function qrSvg(text, quiet){
  var g = qrMatrix(text);
  if(!g) return null;
  var n = g.length, q = quiet == null ? 4 : quiet, sz = n + 2*q;
  var d = '';
  for(var r=0;r<n;r++) for(var c=0;c<n;c++) if(g[r][c]) d += 'M'+(c+q)+' '+(r+q)+'h1v1h-1z';
  return '<svg viewBox="0 0 '+sz+' '+sz+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR-код">' +
         '<rect class="qr-bg" width="'+sz+'" height="'+sz+'"/>' +
         '<path class="qr-dark" d="'+d+'"/></svg>';
}
W.__qrMatrix = qrMatrix;                               /* для перевірки з node */
$$('.qr').forEach(function(box){
  var url = box.dataset.url || 'https://naurok.com.ua/test/join';
  var code = box.dataset.code || '';
  var svg = qrSvg(url);
  var pic = el('div','pic', svg || '<p style="padding:20px">Задовге посилання для QR</p>');
  var side = el('div','side');
  side.innerHTML = '<div class="k">Код доступу</div><div class="v"></div>' +
                   '<p class="lab" style="margin-top:8px"></p>';
  $('.v',side).textContent = code || '— — — — — — —';
  $('.lab',side).textContent = url.replace(/^https?:\/\//,'');
  box.insertBefore(pic, box.firstChild);
  box.appendChild(side);
});

/* ─────────────────────────────────────────────────────────────────────
   C10 · АНІМАЦІЇ — спільне
   Правило для всіх: початковий стан малюється СИНХРОННО, без rAF.
   У headless Chrome (tools/check_decks.py) анімації не крутяться, і
   компонент, який малюється тільки в анімації, там виглядав би порожнім.
   Рух додається зверху й нічого не вирішує.
   Каталог і пошук «чи є анімація під задачу» — tools/components.py --під.
   ───────────────────────────────────────────────────────────────────── */
function abtn(row, txt, cls, fn){
  var b = el('button', 'ab' + (cls ? ' ' + cls : ''));
  b.type = 'button'; b.textContent = txt;
  on(b,'click',function(e){ e.stopPropagation(); fn(b); });
  row.appendChild(b);
  return b;
}
function arow(box){ var r = el('div','arow'); box.appendChild(r); return r; }
function asay(box){ var s = el('div','asay'); box.appendChild(s); return s; }
/* Число для показу: ціле — з пробілами по тисячах, дробове — з комою. */
function anum(v){
  if(Math.abs(v - Math.round(v)) < 1e-9) return spaceNum(Math.round(v));
  return String(Math.round(v*1000)/1000).replace('.', ',');
}
/* Плавний перехід величини від from до to; кожен кадр — cb(значення).
   Якщо кадрів немає (headless), значення однаково стане кінцевим. */
function atween(box, from, to, ms, cb){
  if(box.__tw) cancelAnimationFrame(box.__tw);
  var t0 = 0;
  cb(from);
  function go(ts){
    if(!t0) t0 = ts;
    var k = Math.min(1, (ts - t0)/ms);
    cb(from + (to - from)*(1 - Math.pow(1 - k, 3)));
    if(k < 1) box.__tw = requestAnimationFrame(go);
  }
  box.__tw = requestAnimationFrame(go);
  setTimeout(function(){ if(box.__tw) cancelAnimationFrame(box.__tw); cb(to); }, ms + 90);
}

/* ─────────────────────────────────────────────────────────────────────
   C11 · .ordops — вираз згортається по одній дії
   <div class="ordops" data-expr="54 + (32 − 17) − (43 − 11)"></div>
   Кроки рахує скрипт: спочатку дужки, потім · та :, потім + і − зліва
   направо. Крок відкривається пробілом, як і будь-яка інша відповідь.
   ───────────────────────────────────────────────────────────────────── */
function opTok(s){
  var t = [], i = 0, n = s.length;
  while(i < n){
    var c = s.charAt(i);
    if(c === ' '){ i++; continue; }
    if(c >= '0' && c <= '9'){
      var j = i;
      while(j < n && /[0-9.,]/.test(s.charAt(j))) j++;
      t.push({k:'n', v: parseFloat(s.slice(i,j).replace(',','.'))});
      i = j; continue;
    }
    if(c === '(' || c === ')'){ t.push({k:c}); i++; continue; }
    if('+-−·*×:/÷'.indexOf(c) >= 0){ t.push({k:'o', v:c}); i++; continue; }
    return null;                      /* незрозумілий символ — не беремось */
  }
  return t.length ? t : null;
}
function opPrec(o){ return (o === '+' || o === '-' || o === '−') ? 1 : 2; }
function opCalc(a, o, b){
  if(o === '+') return a + b;
  if(o === '-' || o === '−') return a - b;
  if(o === ':' || o === '/' || o === '÷') return a / b;
  return a * b;
}
function opText(t){ return t.k === 'n' ? anum(t.v) : (t.k === 'o' ? t.v : t.k); }
/* Дужки тримаються свого вмісту: «(32 − 17)», а не «( 32 − 17 )». */
function opJoin(t, from, to){
  var s = '';
  for(var i = from; i <= to; i++){
    var c = opText(t[i]);
    if(s && c !== ')' && s.charAt(s.length-1) !== '(') s += ' ';
    s += c;
  }
  return s;
}
/* Один крок: що рахуємо (від..до) і на що це заміниться. */
function opStep(t){
  var open = -1, close = -1, i;
  for(i = 0; i < t.length; i++){
    if(t[i].k === '(') open = i;
    else if(t[i].k === ')'){ close = i; break; }
  }
  var from = open >= 0 ? open + 1 : 0, to = close >= 0 ? close - 1 : t.length - 1;
  var best = -1, prec = 0;
  for(i = from; i <= to; i++){
    if(t[i].k === 'o' && opPrec(t[i].v) > prec){ prec = opPrec(t[i].v); best = i; }
  }
  if(best < 0){                       /* у дужках лишилось одне число — знімаємо дужки */
    if(open < 0) return null;
    return {cut:[open, close], val:t[from].v, act:[open, close], paren:true, bare:true};
  }
  var a = t[best-1], b = t[best+1];
  if(!a || !b || a.k !== 'n' || b.k !== 'n') return null;
  var val = opCalc(a.v, t[best].v, b.v);
  var whole = (open >= 0 && best - 1 === from && best + 1 === to);
  return {
    cut:  whole ? [open, close] : [best-1, best+1],
    act:  whole ? [open, close] : [best-1, best+1],
    val:  val, paren: whole || open >= 0, prec: prec,
    log:  (whole ? '(' : '') + anum(a.v) + ' ' + t[best].v + ' ' + anum(b.v) + (whole ? ')' : '') +
          ' = ' + anum(val)
  };
}
function opFrames(t){
  var F = [], guard = 0;
  while(guard++ < 40){
    var st = opStep(t);
    if(!st){ F.push({t:t, act:null, nw:-1}); break; }
    F.push({t:t, act:st.act, nw:-1, say:
      st.paren ? 'Спочатку — те, що в дужках.'
               : (st.prec === 2 ? 'Множення й ділення — раніше за додавання.'
                                : 'Дужок немає — рахуємо зліва направо.')});
    var next = t.slice(0, st.cut[0]).concat([{k:'n', v:st.val}], t.slice(st.cut[1] + 1));
    F[F.length-1].log = st.log;
    t = next;
    if(t.length === 1){
      F.push({t:t, act:null, nw:0, say:'Відповідь: ' + anum(t[0].v) + '.'});
      break;
    }
    F[F.length-1].nwNext = st.cut[0];
  }
  /* позначити в кожному кадрі число, яке щойно стало на місце дії */
  for(var i = 1; i < F.length; i++) if(F[i].nw < 0) F[i].nw = F[i-1].nwNext;
  return F;
}
$$('.ordops').forEach(function(box){
  var src = (box.dataset.expr || box.textContent || '').trim();
  var toks = opTok(src);
  box.textContent = '';
  if(!toks){ box.textContent = src; return; }
  var F = opFrames(toks);
  var view = el('div','oe'); box.appendChild(view);
  var say  = asay(box);
  var ol   = el('ol','olog'); box.appendChild(ol);
  F.forEach(function(f,i){
    if(!i) return;
    var li = el('li','hide'); li.textContent = F[i-1].log || ''; ol.appendChild(li);
  });
  box.__at = -1;
  box.__paint = function(){
    var shown = 0;
    $$('li', ol).forEach(function(li){ if(li.classList.contains('on')) shown++; });
    if(shown >= F.length) shown = F.length - 1;
    var f = F[shown], pop = (shown !== box.__at);
    box.__at = shown;
    view.textContent = '';
    var i = 0;
    while(i < f.t.length){
      var e;
      if(f.act && i === f.act[0]){
        e = el('span','act');
        e.textContent = opJoin(f.t, f.act[0], f.act[1]);
        i = f.act[1] + 1;
      } else {
        e = el('span', f.t[i].k === 'o' ? 'o' : '');
        if(i === f.nw && pop) e.className += ' nw';
        if(f.t.length === 1) e.className += ' fin';
        e.textContent = opText(f.t[i]);
        i++;
      }
      view.appendChild(e);
    }
    say.textContent = f.say || '';
    fit();
  };
  box.__paint();
});

/* ─────────────────────────────────────────────────────────────────────
   C12 · .frm — ланцюжок тотожних перетворень запису
   <div class="frm"><ol>
     <li data-say="Знаменники однакові">…html кроку…</li>
     <li class="cut" data-say="Скорочуємо">…</li>   ← перед цим кроком
   </ol></div>                                        закреслюються .cf
   Список у розмітці не показується — він лише рахує пробіли; на екрані
   видно один крок, найсвіжіший.
   ───────────────────────────────────────────────────────────────────── */
$$('.frm').forEach(function(box){
  var ol = $('ol', box);
  if(!ol) return;
  var steps = $$('li', ol).map(function(li){
    return {h: li.innerHTML, say: li.dataset.say || '', cut: li.classList.contains('cut')};
  });
  if(!steps.length) return;
  var view = el('div','fview'), say = asay(box);
  box.insertBefore(view, ol);
  box.insertBefore(say, ol);
  $$('li', ol).forEach(function(li,i){
    li.innerHTML = '';
    li.className = i ? 'hide' : '';
  });
  box.__at = -1;
  box.__paint = function(){
    var shown = 0;
    $$('li', ol).forEach(function(li,i){ if(!i || li.classList.contains('on')) shown = i; });
    if(shown === box.__at) return;
    var was = box.__at;
    box.__at = shown;
    /* крок «скорочення»: спершу закреслити множники в попередньому кадрі */
    if(steps[shown].cut && was === shown - 1 && was >= 0){
      view.innerHTML = steps[was].h;
      view.classList.add('cut');
      say.textContent = steps[shown].say;
      setTimeout(function(){
        if(box.__at !== shown) return;
        view.classList.remove('cut');
        view.innerHTML = steps[shown].h;
        fit();
      }, 950);
      return;
    }
    view.classList.remove('cut');
    view.innerHTML = steps[shown].h;
    say.textContent = steps[shown].say;
    fit();
  };
  box.__paint();
});

/* ─────────────────────────────────────────────────────────────────────
   C13 · .fls — копіювати чи перемістити (операції над файлами)
   <div class="fls" data-file="Казка.docx" data-from="Мої документи"
        data-to="Флешка"></div>
   Відповідає на єдине питання, яке діти плутають: скільки файлів лишилось.
   ───────────────────────────────────────────────────────────────────── */
$$('.fls').forEach(function(box){
  var name = box.dataset.file || 'Казка.docx',
      nmA  = box.dataset.from || 'Мої документи',
      nmB  = box.dataset.to   || 'Флешка';
  box.textContent = '';
  var wrap = el('div','flw');
  wrap.innerHTML =
    '<div class="fold"><span class="nm"><i></i>' + nmA + '</span><div class="slot"></div></div>' +
    '<span class="farr">→</span>' +
    '<div class="fold"><span class="nm"><i></i>' + nmB + '</span><div class="slot"></div></div>';
  box.appendChild(wrap);
  var A = $$('.slot', wrap)[0], B = $$('.slot', wrap)[1];
  var row = arow(box), say = asay(box), chip;

  function make(){
    var c = el('span','fchip');
    c.innerHTML = '<span class="ic"></span>';
    c.appendChild(D.createTextNode(name));
    return c;
  }
  function fly(c, to, done){
    var r = c.getBoundingClientRect(), br = wrap.getBoundingClientRect();
    c.style.width = r.width + 'px';
    c.style.left = (r.left - br.left) + 'px';
    c.style.top  = (r.top  - br.top ) + 'px';
    c.classList.add('fly');
    wrap.appendChild(c);
    var slot = to.getBoundingClientRect();
    setTimeout(function(){
      c.style.left = (slot.left - br.left + 8) + 'px';
      c.style.top  = (slot.top  - br.top  + 8) + 'px';
    }, 30);
    setTimeout(function(){
      c.classList.remove('fly'); c.removeAttribute('style'); to.appendChild(c);
      if(done) done();
    }, 950);
  }
  function reset(){
    A.textContent = ''; B.textContent = '';
    $$('.fly', wrap).forEach(function(x){ x.parentNode.removeChild(x); });
    chip = make(); A.appendChild(chip);
    say.textContent = 'Файл «' + name + '» лежить у теці «' + nmA + '». Файлів: 1.';
  }
  abtn(row, 'Перемістити', '', function(){
    if(!A.contains(chip)){ say.textContent = 'Файл уже в другій теці — тисни «Спочатку».'; return; }
    say.textContent = 'Переміщуємо…';
    fly(chip, B, function(){
      say.textContent = 'ПЕРЕМІСТИТИ: файл один, він просто в іншій теці. Файлів: 1.';
    });
  });
  abtn(row, 'Копіювати', '', function(){
    if(!A.contains(chip)){ say.textContent = 'Спершу «Спочатку» — щоб файл був у першій теці.'; return; }
    say.textContent = 'Копіюємо…';
    var c = make();
    var r = chip.getBoundingClientRect(), br = wrap.getBoundingClientRect();
    c.style.width = r.width + 'px';
    c.style.left = (r.left - br.left) + 'px';
    c.style.top  = (r.top  - br.top ) + 'px';
    c.classList.add('fly'); wrap.appendChild(c);
    var slot = B.getBoundingClientRect();
    setTimeout(function(){
      c.style.left = (slot.left - br.left + 8) + 'px';
      c.style.top  = (slot.top  - br.top  + 8) + 'px';
    }, 30);
    setTimeout(function(){
      c.classList.remove('fly'); c.removeAttribute('style'); B.appendChild(c);
      say.textContent = 'КОПІЮВАТИ: оригінал лишився, зʼявився ще один файл. Файлів: 2.';
    }, 950);
  });
  abtn(row, 'Спочатку', 'q', reset);
  reset();
});

/* ─────────────────────────────────────────────────────────────────────
   C14 · .mv — задача на рух: два тіла, смуги пройденого шляху, рівняння
   <div class="mv" data-s="310" data-v="60,80" data-start="0,0.5"
        data-names="Вантажівка,Легковик" data-mode="meet"
        data-eq="2,5x + 2(x + 20) = 310  →  x = 60"></div>
   Смуги ростуть разом із тілами: у мить зустрічі видно, що вони вклалися
   у відстань без залишку — звідси й береться рівняння.
   mode="meet" — назустріч, mode="chase" — навздогін (обидва з лівого краю).
   ───────────────────────────────────────────────────────────────────── */
$$('.mv').forEach(function(box){
  var S  = parseFloat(box.dataset.s) || 100,
      V  = (box.dataset.v || '60,80').split(',').map(parseFloat),
      T0 = (box.dataset.start || '0,0').split(',').map(parseFloat),
      NM = (box.dataset.names || 'Перший,Другий').split(','),
      chase = box.dataset.mode === 'chase',
      U  = box.dataset.unit || '',
      X0 = 60, W = 600, K = W/S;
  var v1 = V[0] || 60, v2 = V[1] || 80, t1 = T0[0] || 0, t2 = T0[1] || 0;
  /* «туди й назад»: той самий шлях двома швидкостями, відомий лише ЗАГАЛЬНИЙ час.
     Тоді смуги під дорогою міряють не кілометри, а ЧАС — вони й складаються в нього,
     а сам шлях s лишається невідомим, доки вчитель не натисне «Показати s». */
  var back = box.dataset.mode === 'there-back', TT = parseFloat(box.dataset.t) || 0, legT = 0;
  if(back){
    S = TT * v1 * v2 / (v1 + v2);
    K = W / S; legT = S / v1;
  }
  /* коли зустрінуться: назустріч — сума шляхів = S; навздогін — шляхи рівні */
  var TEND = back ? TT
                  : (chase ? (v2 * t2 - v1 * t1) / (v2 - v1)
                           : (S + v1 * t1 + v2 * t2) / (v1 + v2));
  if(!(TEND > 0) || !isFinite(TEND)) TEND = 1;
  var meetKm = back ? S : v1 * (TEND - t1);

  box.textContent = '';
  var svg = el('div','mvs');
  svg.innerHTML =
    '<svg viewBox="0 0 720 128" role="img" aria-label="Рух на відрізку ' + S + '">' +
    '<line class="rd" x1="60" y1="44" x2="660" y2="44"></line>' +
    '<line class="tick" x1="60" y1="32" x2="60" y2="56"></line>' +
    '<line class="tick" x1="660" y1="32" x2="660" y2="56"></line>' +
    '<text class="lbl b" x="60" y="70" text-anchor="middle">A</text>' +
    '<text class="lbl b" x="660" y="70" text-anchor="middle">B</text>' +
    '<text class="lbl sl" x="360" y="18" text-anchor="middle"></text>' +
    '<line class="meet" x1="0" y1="30" x2="0" y2="120"></line>' +
    '<rect class="b1" x="60" y="80" width="0" height="13" rx="3"></rect>' +
    '<rect class="b2" x="660" y="100" width="0" height="13" rx="3"></rect>' +
    '<text class="vlbl o1" x="64" y="90" dominant-baseline="middle"></text>' +
    '<text class="vlbl o2" x="656" y="110" text-anchor="end" dominant-baseline="middle"></text>' +
    '<g class="g1"><rect x="-22" y="-15" width="42" height="15" rx="3"></rect>' +
      '<rect x="5" y="-25" width="14" height="10" rx="2"></rect>' +
      '<circle cx="-12" cy="2" r="4"></circle><circle cx="12" cy="2" r="4"></circle>' +
      '<text class="vlbl" x="0" y="-30" text-anchor="middle">' + NM[0] + '</text></g>' +
    '<g class="g2"><rect x="-17" y="-13" width="34" height="13" rx="4"></rect>' +
      '<path d="M-10 -13 L-5 -21 L7 -21 L12 -13 Z"></path>' +
      '<circle cx="-9" cy="2" r="3.6"></circle><circle cx="9" cy="2" r="3.6"></circle>' +
      '<text class="vlbl" x="0" y="-26" text-anchor="middle">' + (NM[1] || '') + '</text></g>' +
    '</svg>';
  box.appendChild(svg);
  var info = el('div','mvi');
  info.innerHTML = '<span class="mvclock">t = <b>0</b></span>' +
                   (back ? '' : '<span class="mvgap">між ними <b>' + anum(S) + '</b> ' + U + '</span>') +
                   '<span class="mvall"></span>';
  box.appendChild(info);
  var say = asay(box);
  var res = el('div','mvres');
  if(box.dataset.eq) res.innerHTML = '<p class="eqn">' + box.dataset.eq + '</p>';
  box.appendChild(res);
  var row = arow(box);
  var sl = el('input'); sl.type = 'range'; sl.min = 0; sl.max = 1000; sl.value = 0;
  sl.className = 'mvsl';

  var q = function(s){ return $(s, svg); };
  var b1 = q('.b1'), b2 = q('.b2'), o1 = q('.o1'), o2 = q('.o2'),
      g1 = q('.g1'), g2 = q('.g2'), mk = q('.meet'), lblS = q('.sl'),
      clock = $('b', $('.mvclock', info)),
      gapBox = $('.mvgap', info), gap = gapBox ? $('b', gapBox) : null,
      all = $('.mvall', info);
  var t = 0, shown = false;
  if(back){
    g2.setAttribute('opacity','0');             /* тіло одне — друга фігурка не потрібна */
    b2.setAttribute('y', 80); o2.setAttribute('y', 90);   /* смуги часу — в один рядок */
  }
  lblS.textContent = back ? 's ' + U : anum(S) + ' ' + U;
  all.textContent = '';

  function draw(){
    var done = t >= TEND - 1e-9;
    if(back){
      var d = t <= legT ? v1*t : S - v2*(t - legT);
      g1.setAttribute('transform','translate(' + (X0 + d*K) + ',44)');
      var w1 = Math.min(t, legT)/TT*W, w2 = Math.max(0, t - legT)/TT*W;
      b1.setAttribute('x', X0); b1.setAttribute('width', w1);
      b2.setAttribute('x', X0 + w1); b2.setAttribute('width', w2);
      o1.textContent = w1 > 46 ? 'туди' : '';
      o2.setAttribute('x', X0 + w1 + w2 - 6);
      o2.textContent = w2 > 52 ? 'назад' : '';
      clock.textContent = anum(Math.round(t*100)/100) + ' з ' + anum(TT) + ' год';
      lblS.textContent = shown ? anum(S) + ' ' + U : 's ' + U;
      all.textContent = shown
        ? 'туди ' + anum(legT) + ' год, назад ' + anum(TT - legT) + ' год'
        : 'смуги під дорогою — це ЧАС, а не кілометри';
      box.classList.toggle('done', done);
      say.textContent = done
        ? 'Повернувся. Час туди й час назад разом дали ' + anum(TT) + ' год.'
        : (t <= legT ? 'Іде туди — швидше, тому на цей самий шлях витрачає менше часу.'
                     : 'Повертається повільніше — смуга часу росте швидше.');
      sl.value = Math.round(t/TEND*1000);
      return;
    }
    var s1 = Math.max(0, v1*(t - t1)), s2 = Math.max(0, v2*(t - t2));
    var x1 = X0 + s1*K, x2 = chase ? X0 + s2*K : X0 + (S - s2)*K;
    g1.setAttribute('transform','translate(' + x1 + ',70)');
    g2.setAttribute('transform','translate(' + x2 + ',70)');
    b1.setAttribute('width', s1*K);
    if(chase){ b2.setAttribute('x', X0); b2.setAttribute('width', s2*K); }
    else { b2.setAttribute('x', x2); b2.setAttribute('width', s2*K); }
    o1.textContent = s1*K > 34 ? anum(Math.round(s1)) : '';
    o2.textContent = s2*K > 34 ? anum(Math.round(s2)) : '';
    o2.setAttribute('x', chase ? X0 + s2*K - 4 : 656);
    clock.textContent = anum(Math.round(t*100)/100);
    var g = chase ? Math.max(0, s1 - s2) : Math.max(0, S - s1 - s2);
    if(gap) gap.textContent = anum(Math.round(g));
    mk.setAttribute('x1', X0 + meetKm*K); mk.setAttribute('x2', X0 + meetKm*K);
    box.classList.toggle('done', done);
    say.textContent = done
      ? (chase ? 'Наздогнав. Шляхи зрівнялись.' : 'Зустрілись. Разом подолали ' + anum(S) + '.')
      : (t < Math.max(t1,t2) ? 'Другий виїде пізніше — перший уже в дорозі.'
                            : (chase ? 'Відстань між ними меншає.' : 'Їдуть назустріч.'));
    sl.value = Math.round(t/TEND*1000);
  }
  /* Крок, а не автопрогравання (вчитель, 25.09.2026): одне натискання —
     десята частина дороги, перехід малює CSS. Повзунок лишається для того,
     щоб відмотати в будь-яку мить. */
  abtn(row, 'Крок', '', function(){
    t = t >= TEND - 1e-9 ? 0 : Math.min(TEND, t + TEND/10);
    draw();
  });
  abtn(row, 'Спочатку', 'q', function(){ t = 0; draw(); });
  if(back) abtn(row, 'Показати s', 'q', function(){ shown = !shown; draw(); });
  row.appendChild(sl);
  on(sl,'input',function(e){ e.stopPropagation(); t = +sl.value/1000*TEND; draw(); });
  on(sl,'click',function(e){ e.stopPropagation(); });
  draw();
});

/* ─────────────────────────────────────────────────────────────────────
   C15 · .vang — вертикальні й суміжні кути; пряму можна крутити
   <div class="vang" data-angle="55" data-ratio="4:5"></div>
   data-lock="1" — лише показати, без перетягування.
   Числа біжать, а рівність вертикальних лишається — це й треба побачити
   перед доведенням.
   ───────────────────────────────────────────────────────────────────── */
$$('.vang').forEach(function(box){
  var CX = 260, CY = 180, R = 145, HR = 132, AR = 46, AR2 = 66, LR = 70, LR2 = 92;
  var th = parseFloat(box.dataset.angle) || 55;
  var lock = box.dataset.lock === '1';
  box.textContent = '';
  var wrap = el('div','vsvg');
  wrap.innerHTML =
    '<svg viewBox="0 0 520 360" role="img" aria-label="Дві прямі, що перетинаються">' +
    '<line class="ln" x1="105" y1="180" x2="415" y2="180"></line>' +
    '<line class="ln l2" x1="105" y1="180" x2="415" y2="180"></line>' +
    '<path class="p1 a1"></path><path class="p2 a2"></path>' +
    '<path class="p1 a3"></path><path class="p2 a4"></path>' +
    '<circle cx="260" cy="180" r="4.5" class="dot"></circle>' +
    '<text class="pt" x="250" y="203">K</text>' +
    '<text class="pt" x="91" y="186">A</text><text class="pt" x="429" y="186">B</text>' +
    '<text class="pt pc"></text><text class="pt pd"></text>' +
    '<text class="an p1 t1"></text><text class="an p2 t2"></text>' +
    '<text class="an p1 t3"></text><text class="an p2 t4"></text>' +
    (lock ? '' : '<circle class="hnd" r="9"></circle>') +
    '</svg>';
  box.appendChild(wrap);
  var side = el('div','vside');
  side.innerHTML =
    '<p><span class="eq p1">∠BKC = ∠AKD = <b class="v1"></b></span><br>' +
    '<span class="eq p2">∠AKC = ∠BKD = <b class="v2"></b></span></p>' +
    '<p class="ok">вертикальні — <b>рівні завжди</b></p><p class="lab sum"></p>';
  box.appendChild(side);
  var svg = $('svg', wrap);
  var l2 = $('.l2', svg), h = $('.hnd', svg), pc = $('.pc', svg), pd = $('.pd', svg);
  var A = ['.a1','.a2','.a3','.a4'].map(function(s){ return $(s, svg); });
  var T = ['.t1','.t2','.t3','.t4'].map(function(s){ return $(s, svg); });
  var v1 = $('.v1', side), v2 = $('.v2', side), sum = $('.sum', side);

  function P(a, r){ var k = a*Math.PI/180; return [CX + r*Math.cos(k), CY - r*Math.sin(k)]; }
  function arc(a1, a2, r){
    var p = P(a1,r), q2 = P(a2,r);
    return 'M ' + CX + ' ' + CY + ' L ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) +
           ' A ' + r + ' ' + r + ' 0 ' + ((a2-a1) > 180 ? 1 : 0) + ' 0 ' +
           q2[0].toFixed(1) + ' ' + q2[1].toFixed(1) + ' Z';
  }
  function put(e, a, r, txt){
    var p = P(a,r);
    e.setAttribute('x', p[0].toFixed(1)); e.setAttribute('y', p[1].toFixed(1));
    if(txt != null) e.textContent = txt;
  }
  function draw(){
    var c = P(th,R), d = P(th+180,R);
    l2.setAttribute('x1',c[0]); l2.setAttribute('y1',c[1]);
    l2.setAttribute('x2',d[0]); l2.setAttribute('y2',d[1]);
    if(h){ var hp = P(th,HR); h.setAttribute('cx',hp[0]); h.setAttribute('cy',hp[1]); }
    put(pc, th, R+17, 'C'); put(pd, th+180, R+17, 'D');
    A[0].setAttribute('d', arc(0, th, AR));
    A[1].setAttribute('d', arc(th, 180, AR2));
    A[2].setAttribute('d', arc(180, 180+th, AR));
    A[3].setAttribute('d', arc(180+th, 360, AR2));
    var a = Math.round(th), b = 180 - a;
    put(T[0], th/2, LR, a + '°');
    put(T[1], (th+180)/2, LR2, b + '°');
    put(T[2], 180 + th/2, LR, a + '°');
    put(T[3], (180+th+360)/2, LR2, b + '°');
    v1.textContent = a + '°'; v2.textContent = b + '°';
    sum.textContent = 'суміжні: ' + a + '° + ' + b + '° = 180°';
  }
  function to(target){ atween(box, th, target, 650, function(v){ th = v; draw(); }); }
  if(!lock){
    var down = false;
    function angleAt(e){
      var r = svg.getBoundingClientRect(), s = r.width/520;
      var x = (e.clientX - r.left)/s, y = (e.clientY - r.top)/s;
      var a = Math.atan2(CY - y, x - CX)*180/Math.PI;
      if(a < 0) a += 180;
      return Math.max(12, Math.min(168, a));
    }
    on(svg,'pointerdown',function(e){
      e.stopPropagation(); down = true; svg.setPointerCapture(e.pointerId);
      if(box.__tw) cancelAnimationFrame(box.__tw);
      th = angleAt(e); draw();
    });
    on(svg,'pointermove',function(e){ if(down){ th = angleAt(e); draw(); } });
    ['pointerup','pointercancel'].forEach(function(k){ on(svg,k,function(){ down = false; }); });
    var row = arow(box);
    if(box.dataset.ratio){
      var r2 = box.dataset.ratio.split(':').map(parseFloat);
      abtn(row, 'Приклад ' + r2[0] + ' : ' + r2[1], '', function(){
        to(180*r2[0]/(r2[0] + r2[1]));
      });
    }
    abtn(row, 'Прямий кут', 'q', function(){ to(90); });
    abtn(row, 'Спочатку', 'q', function(){ to(parseFloat(box.dataset.angle) || 55); });
  }
  draw();
});

/* ─────────────────────────────────────────────────────────────────────
   C16 · .qfam — родина чотирикутників: паралелограм → прямокутник /
   ромб → квадрат. Фігура ПЕРЕТІКАЄ, а не замінюється картинкою, тому
   видно, що квадрат — це одночасно прямокутник і ромб.
   <div class="qfam"></div>  (data-start="rect" — почати з прямокутника)
   ───────────────────────────────────────────────────────────────────── */
$$('.qfam').forEach(function(box){
  var SH = {
    par:  [[100,210],[240,210],[300,100],[160,100]],
    rect: [[110,210],[270,210],[270,100],[110,100]],
    rhmb: [[ 90,210],[230,210],[300, 89],[160, 89]],
    sqr:  [[125,210],[255,210],[255, 80],[125, 80]]
  };
  var NAME = {par:'паралелограм', rect:'прямокутник', rhmb:'ромб', sqr:'квадрат'};
  var SAY = {
    par:'Паралелограм. Більше нічого поки не вимагаємо.',
    rect:'Додали прямі кути — прямокутник. Діагоналі стали рівними.',
    rhmb:'Додали рівні сторони — ромб. Діагоналі стали перпендикулярними.',
    sqr:'Обидві умови разом — квадрат. Він і прямокутник, і ромб водночас.'
  };
  var st = box.dataset.start || 'par';
  var ang = (st === 'rect' || st === 'sqr'), eq = (st === 'rhmb' || st === 'sqr');
  box.textContent = '';
  var wrap = el('div','qsvg');
  wrap.innerHTML =
    '<svg viewBox="0 0 400 265" role="img" aria-label="Чотирикутник, що змінює форму">' +
    '<polygon class="sh"></polygon>' +
    '<line class="dg d1"></line><line class="dg d2"></line>' +
    '<path class="ra r0"></path><path class="ra r1"></path>' +
    '<path class="ra r2"></path><path class="ra r3"></path>' +
    '<line class="tk k0"></line><line class="tk k1"></line>' +
    '<line class="tk k2"></line><line class="tk k3"></line>' +
    '<text class="nm" x="200" y="252"></text></svg>';
  box.appendChild(wrap);
  var side = el('div','qside');
  side.innerHTML =
    '<ul class="prop">' +
    '<li class="on"><b>✓</b><span>протилежні сторони паралельні й рівні</span></li>' +
    '<li><b>·</b><span>усі кути прямі</span></li>' +
    '<li><b>·</b><span>усі сторони рівні</span></li>' +
    '<li><b>·</b><span>діагоналі рівні</span></li>' +
    '<li><b>·</b><span>діагоналі перпендикулярні</span></li></ul>';
  box.appendChild(side);
  var say = asay(box), row = arow(box);
  var svg = $('svg', wrap), poly = $('.sh', svg), nm = $('.nm', svg);
  var R = ['.r0','.r1','.r2','.r3'].map(function(s){ return $(s, svg); });
  var T = ['.k0','.k1','.k2','.k3'].map(function(s){ return $(s, svg); });
  var d1 = $('.d1', svg), d2 = $('.d2', svg);
  var pr = $$('li', side);
  var cur = SH[st === 'rect' ? 'rect' : st === 'rhmb' ? 'rhmb' : st === 'sqr' ? 'sqr' : 'par']
              .map(function(p){ return p.slice(); });

  function key(){ return ang && eq ? 'sqr' : ang ? 'rect' : eq ? 'rhmb' : 'par'; }
  function nrm(v){ var L = Math.sqrt(v[0]*v[0] + v[1]*v[1]) || 1; return [v[0]/L, v[1]/L]; }
  function paint(){
    poly.setAttribute('points', cur.map(function(p){
      return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '));
    cur.forEach(function(v,i){
      var p = cur[(i+3)%4], n = cur[(i+1)%4];
      var u = nrm([p[0]-v[0], p[1]-v[1]]), w = nrm([n[0]-v[0], n[1]-v[1]]), s = 17;
      R[i].setAttribute('d', 'M ' + (v[0]+u[0]*s) + ' ' + (v[1]+u[1]*s) +
        ' L ' + (v[0]+u[0]*s+w[0]*s) + ' ' + (v[1]+u[1]*s+w[1]*s) +
        ' L ' + (v[0]+w[0]*s) + ' ' + (v[1]+w[1]*s));
      var q2 = cur[(i+1)%4], mx = (v[0]+q2[0])/2, my = (v[1]+q2[1])/2;
      var d = nrm([q2[0]-v[0], q2[1]-v[1]]), nn = [-d[1], d[0]], k = 8;
      T[i].setAttribute('x1', mx+nn[0]*k); T[i].setAttribute('y1', my+nn[1]*k);
      T[i].setAttribute('x2', mx-nn[0]*k); T[i].setAttribute('y2', my-nn[1]*k);
    });
    d1.setAttribute('x1',cur[0][0]); d1.setAttribute('y1',cur[0][1]);
    d1.setAttribute('x2',cur[2][0]); d1.setAttribute('y2',cur[2][1]);
    d2.setAttribute('x1',cur[1][0]); d2.setAttribute('y1',cur[1][1]);
    d2.setAttribute('x2',cur[3][0]); d2.setAttribute('y2',cur[3][1]);
  }
  function state(){
    var k = key();
    box.classList.toggle('ang', ang); box.classList.toggle('eq', eq);
    nm.textContent = NAME[k]; say.textContent = SAY[k];
    [true, ang, eq, ang, eq].forEach(function(v,i){
      pr[i].classList.toggle('on', !!v);
      $('b', pr[i]).textContent = v ? '✓' : '·';
    });
  }
  function morph(){
    var to = SH[key()], from = cur.map(function(p){ return p.slice(); });
    atween(box, 0, 1, 620, function(k){
      cur = from.map(function(p,i){
        return [p[0] + (to[i][0]-p[0])*k, p[1] + (to[i][1]-p[1])*k]; });
      paint();
    });
    state();
  }
  var bA = abtn(row, 'усі кути прямі', '', function(b){
    ang = !ang; b.setAttribute('aria-pressed', String(ang)); morph(); });
  var bE = abtn(row, 'усі сторони рівні', '', function(b){
    eq = !eq; b.setAttribute('aria-pressed', String(eq)); morph(); });
  var bD = abtn(row, 'діагоналі', 'q', function(b){
    var on2 = !box.classList.contains('diag');
    box.classList.toggle('diag', on2); b.setAttribute('aria-pressed', String(on2)); });
  abtn(row, 'Спочатку', 'q', function(){
    ang = eq = false;
    bA.setAttribute('aria-pressed','false'); bE.setAttribute('aria-pressed','false');
    morph(); });
  bA.setAttribute('aria-pressed', String(ang));
  bE.setAttribute('aria-pressed', String(eq));
  bD.setAttribute('aria-pressed','false');
  paint(); state();
});

/* ─────────────────────────────────────────────────────────────────────
   C17 · .cnv — згортка: ядро їде по зображенню й малює карту ознак
   <div class="cnv" data-k="1,0,-1,2,0,-2,1,0,-1"></div>
   data-img="50,50,…" — своє зображення (квадрат N×N), інакше світлий
   прямокутник на темному тлі: на ньому видно головне — вертикальне ядро
   світиться на бічних межах і мовчить на верхній та нижній.
   ───────────────────────────────────────────────────────────────────── */
$$('.cnv').forEach(function(box){
  var IMG = [], N = 8, r, c;
  if(box.dataset.img){
    var a = box.dataset.img.split(/[,\s]+/).map(Number).filter(function(x){ return !isNaN(x); });
    N = Math.round(Math.sqrt(a.length));
    for(r = 0; r < N; r++){ IMG[r] = []; for(c = 0; c < N; c++) IMG[r][c] = a[r*N + c]; }
  } else {
    var bg = parseInt(box.dataset.bg || '50', 10), fg = parseInt(box.dataset.fg || '200', 10);
    for(r = 0; r < N; r++){ IMG[r] = []; for(c = 0; c < N; c++)
      IMG[r][c] = (r >= 1 && r <= 6 && c >= 2 && c <= 5) ? fg : bg; }
  }
  var kk = (box.dataset.k || '1,0,-1,2,0,-2,1,0,-1').split(',').map(Number);
  var K = [[kk[0],kk[1],kk[2]],[kk[3],kk[4],kk[5]],[kk[6],kk[7],kk[8]]];
  var M = N - 2, LAST = M*M - 1;

  box.textContent = '';
  var wrap = el('div','cnw');
  wrap.innerHTML =
    '<div class="col"><p class="cap">зображення ' + N + '×' + N + ' · яскравість</p>' +
      '<div class="gr in"></div></div>' +
    '<div class="col ker"><p class="cap">ядро</p><div class="kg"></div><p class="sum"></p></div>' +
    '<div class="col"><p class="cap">карта ознак ' + M + '×' + M + ' · |сума|</p>' +
      '<div class="gr out"></div></div>';
  box.appendChild(wrap);
  var inG = $('.gr.in', wrap), outG = $('.gr.out', wrap), kg = $('.kg', wrap),
      sum = $('.sum', wrap), say = asay(box), row = arow(box);
  inG.style.gridTemplateColumns  = 'repeat(' + N + ',1fr)';
  outG.style.gridTemplateColumns = 'repeat(' + M + ',1fr)';

  function gray(v){ return 'rgb(' + v + ',' + v + ',' + v + ')'; }
  function ink(v){ return v > 128 ? '#111' : '#eee'; }
  var inC = [], outC = [];
  for(r = 0; r < N; r++) for(c = 0; c < N; c++){
    var d = el('div','cl');
    d.style.background = gray(IMG[r][c]); d.style.color = ink(IMG[r][c]);
    d.textContent = IMG[r][c]; inG.appendChild(d); inC.push(d);
  }
  for(r = 0; r < M*M; r++){
    var o = el('div','cl empty'); o.textContent = '0'; outG.appendChild(o); outC.push(o);
  }
  K.forEach(function(rw){ rw.forEach(function(k){
    var d = el('div', k > 0 ? 'plus' : (k < 0 ? 'minus' : ''));
    d.textContent = k > 0 ? '+' + k : String(k);
    kg.appendChild(d);
  });});

  var pos = -1, timer = null, play;
  function conv(rr,cc){
    var s = 0;
    for(var i = 0; i < 3; i++) for(var j = 0; j < 3; j++) s += IMG[rr+i-1][cc+j-1]*K[i][j];
    return s;
  }
  function show(p){
    inC.forEach(function(d){ d.classList.remove('win','ctr'); });
    if(p < 0){ sum.innerHTML = 'Тисни «Крок» — ядро стане на перше місце.'; say.textContent = ''; return; }
    var rr = 1 + Math.floor(p/M), cc = 1 + (p % M);
    for(var i = -1; i <= 1; i++) for(var j = -1; j <= 1; j++)
      inC[(rr+i)*N + (cc+j)].classList.add('win');
    inC[rr*N + cc].classList.add('ctr');
    var s = conv(rr,cc), v = Math.min(255, Math.abs(s)), o = outC[(rr-1)*M + (cc-1)];
    o.classList.remove('empty'); o.textContent = v;
    o.style.background = gray(v); o.style.color = ink(v);
    sum.innerHTML = 'сума = <b>' + s + '</b><br>|сума| → <span class="big">' + v + '</span>';
    say.textContent = v > 200 ? 'Тут перепад — ядро спалахнуло.'
      : (v === 0 ? 'Зліва і справа однаково — нуль. Цю межу ядро не бачить.'
                 : 'Невеликий перепад — невелике число.');
  }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }
  function step(){ if(pos >= LAST) return; pos++; show(pos); }
  function reset(){
    stop(); pos = -1;
    outC.forEach(function(o){ o.className = 'cl empty'; o.textContent = '0';
      o.removeAttribute('style'); });
    show(-1);
  }
  abtn(row, 'Крок', '', function(){ step(); });
  abtn(row, 'Спочатку', 'q', reset);
  reset();
});


/* ─────────────────────────────────────────────────────────────────────
   C18 · .back — рух назад у часі: «скільки було спочатку»
   <div class="back" data-end="68" data-steps="-15,+23,-17,+12"
        data-what="У вагоні" data-unit="пасажирів"
        data-labels="1-ша зупинка,1-ша зупинка,2-га зупинка,2-га зупинка"></div>
   Малюємо вагон: на платформі стоять ті самі люди, що вийшли чи зайшли,
   і клас бачить, чому назад у часі «вийшло 15» перетворюється на «+15».
   Один лічильник стану на обидві кнопки: pos — скільки дій уже сталося,
   cur = start + сума перших pos дій. Вперед і назад ходять по ньому ж,
   тому переключати напрям можна будь-коли (раніше вони мали свої лічильники
   й розʼїжджались — 25.09.2026).
   ───────────────────────────────────────────────────────────────────── */
$$('.back').forEach(function(box){
  var end  = parseFloat(box.dataset.end) || 0,
      what = box.dataset.what || 'Було',
      unit = box.dataset.unit || '';
  var ST = (box.dataset.steps || '').split(',').map(function(x){
    return parseFloat(x.replace('−','-').replace(/\s/g,''));
  }).filter(function(x){ return !isNaN(x); });
  if(!ST.length) return;
  var LB = (box.dataset.labels || '').split(',').map(function(x){ return x.trim(); });
  var sum = ST.reduce(function(a,b){ return a+b; }, 0), start = end - sum;

  box.textContent = '';
  var svg = el('div');
  svg.innerHTML =
    '<svg class="bcar" viewBox="0 0 700 224" role="img" aria-label="Вагон і пасажири">' +
      '<line class="rail" x1="10" y1="214" x2="690" y2="214"></line>' +
      '<line class="rail" x1="10" y1="196" x2="252" y2="196"></line>' +
      '<rect class="car" x="262" y="40" width="428" height="150" rx="20"></rect>' +
      '<rect class="door" x="278" y="64" width="54" height="126" rx="6"></rect>' +
      '<rect class="win" x="356" y="52" width="70" height="40" rx="6"></rect>' +
      '<rect class="win" x="452" y="52" width="70" height="40" rx="6"></rect>' +
      '<rect class="win" x="548" y="52" width="70" height="40" rx="6"></rect>' +
      '<text class="bwhat" x="500" y="118">' + what + (unit ? ' · ' + unit : '') + '</text>' +
      '<text class="bnum" x="500" y="168">?</text>' +
      '<circle class="wh" cx="330" cy="200" r="13"></circle>' +
      '<circle class="wh" cx="620" cy="200" r="13"></circle>' +
      '<text class="bmark" x="128" y="46"></text>' +
      '<g class="ppg"></g>' +
    '</svg>';
  var sv = svg.firstChild;
  box.appendChild(sv);

  var track = el('div','btrack');
  ST.forEach(function(v,i){
    var c = el('div','bstep');
    c.innerHTML = '<b>' + (v > 0 ? '+' + anum(v) : '−' + anum(-v)) + '</b>' +
                  (LB[i] ? '<span class="bi">' + LB[i] + '</span>' : '');
    track.appendChild(c);
  });
  var fin = el('div','bstep bend');
  fin.innerHTML = '<b>' + anum(end) + '</b><span class="bi">стало</span>';
  track.appendChild(fin);
  box.appendChild(track);
  var say = asay(box), row = arow(box);

  var num  = $('.bnum', sv),
      mark = $('.bmark', sv), ppg = $('.ppg', sv),
      chips = $$('.bstep', track);

  /* pos — скільки дій від початку вже сталося; cur — число зараз */
  var pos = ST.length, cur = end;

  function paint(hi){
    num.textContent = anum(Math.round(cur));
    chips.forEach(function(c,i){
      if(c.classList.contains('bend')) return;
      c.classList.toggle('now', i === hi);
      c.classList.toggle('undone', i >= pos);
    });
    fit();
  }
  /* фігурки: ті самі люди, що в умові. dir='out' — виходять з вагона на
     платформу, dir='in' — з платформи заходять усередину. */
  function people(n, dir){
    ppg.innerHTML = '';
    if(!n){ mark.classList.remove('on'); return; }
    var N = Math.min(n, 24), gs = [];
    for(var i = 0; i < N; i++){
      var col = i % 8, r = Math.floor(i / 8);
      var px = 18 + col * 29, py = 190 - r * 37;
      var g = D.createElementNS('http://www.w3.org/2000/svg','g');
      g.setAttribute('class', 'pp ' + (dir === 'out' ? 'go' : 'come'));
      g.innerHTML = '<circle cx="0" cy="-26" r="7"></circle>' +
                    '<path d="M-8 0 v-12 a8 8 0 0 1 16 0 v12 z"></path>';
      g.__to = 'translate(' + px + ',' + py + ')';
      g.setAttribute('transform', dir === 'out' ? 'translate(304,190)' : g.__to);
      if(dir === 'out') g.classList.add('off');
      ppg.appendChild(g); gs.push(g);
    }
    var go = function(){
      gs.forEach(function(g){
        if(dir === 'out'){ g.classList.remove('off'); g.setAttribute('transform', g.__to); }
        else { g.classList.add('off'); g.setAttribute('transform','translate(304,190)'); }
      });
    };
    if(W.requestAnimationFrame) W.requestAnimationFrame(function(){ W.requestAnimationFrame(go); });
    else go();
  }
  function showMark(txt, cls){
    mark.textContent = txt;
    mark.setAttribute('class', 'bmark on ' + cls);
  }
  function clean(){ ppg.innerHTML = ''; mark.classList.remove('on'); }

  function reset(){
    pos = ST.length; cur = end; clean(); paint(-1);
    say.textContent = 'У кінці ' + what.toLowerCase() + ' ' + anum(end) + '. Ідемо назад: ' +
                      'кожну дію замінюємо на протилежну.';
  }
  abtn(row, 'Крок назад', '', function(){
    if(pos <= 0){ say.textContent = 'Це вже початок: ' + anum(start) + '.'; return; }
    pos--;
    var v = ST[pos], was = cur;
    cur = cur - v;
    /* назад у часі: хто вийшов — повертається у вагон, хто зайшов — виходить */
    people(Math.abs(v), v > 0 ? 'out' : 'in');
    showMark((v > 0 ? '−' : '+') + anum(Math.abs(v)), v > 0 ? 'go' : 'come');
    paint(pos);
    say.textContent = 'Було ' + (v > 0 ? '«зайшло ' + anum(v) + '» — назад віднімаємо ' + anum(v)
                                       : '«вийшло ' + anum(-v) + '» — назад додаємо ' + anum(-v)) +
                      ': ' + anum(was) + ' → ' + anum(cur) +
                      (pos === 0 ? '. Стільки було спочатку.' : '.');
  });
  abtn(row, 'Крок вперед', 'q', function(){
    if(pos >= ST.length){ say.textContent = 'Це вже кінець: ' + anum(end) + '.'; return; }
    var v = ST[pos], was = cur;
    cur = cur + v; pos++;
    people(Math.abs(v), v > 0 ? 'in' : 'out');
    showMark((v > 0 ? '+' : '−') + anum(Math.abs(v)), v > 0 ? 'come' : 'go');
    paint(pos - 1);
    say.textContent = 'Перевірка вперед: ' + (v > 0 ? 'зайшло ' + anum(v) : 'вийшло ' + anum(-v)) +
                      ' — ' + anum(was) + ' → ' + anum(cur) +
                      (pos >= ST.length ? '. Зійшлось із умовою.' : '.');
  });
  abtn(row, 'Спочатку', 'q', reset);
  reset();
});

/* ─────────────────────────────────────────────────────────────────────
   C19 · .sqdiag — діагоналі квадрата по кроках
   <div class="sqdiag"></div>
   Крок відкривається пробілом. Показує, звідки в таких задачах беруться
   всі числа: 45° у вершинах і прямий кут у центрі.
   ───────────────────────────────────────────────────────────────────── */
$$('.sqdiag').forEach(function(box){
  var L = (box.dataset.labels || 'A,B,C,D').split(',');
  box.textContent = '';
  var wrap = el('div','sqw');
  wrap.innerHTML =
    '<svg viewBox="0 0 300 290" role="img" aria-label="Квадрат із діагоналями">' +
    '<g class="tri g3"><path d="M50 50 L250 50 L150 150 Z"></path>' +
      '<path d="M250 50 L250 250 L150 150 Z"></path>' +
      '<path d="M250 250 L50 250 L150 150 Z"></path>' +
      '<path d="M50 250 L50 50 L150 150 Z"></path></g>' +
    '<rect class="sq" x="50" y="50" width="200" height="200"></rect>' +
    '<line class="dg g1" x1="50" y1="50" x2="250" y2="250"></line>' +
    '<line class="dg g2" x1="250" y1="50" x2="50" y2="250"></line>' +
    '<path class="ra g2" d="M136 150 A 14 14 0 0 1 150 136"></path>' +
    '<circle class="o g2" cx="150" cy="150" r="4"></circle>' +
    '<text class="an g1" x="72" y="72">45°</text>' +
    '<text class="an g1" x="205" y="238">45°</text>' +
    '<text class="an g2" x="205" y="72">45°</text>' +
    '<text class="an g2" x="72" y="238">45°</text>' +
    '<text class="an o g2" x="168" y="176">90°</text>' +
    '<text class="pt" x="36" y="44">' + L[0] + '</text>' +
    '<text class="pt" x="264" y="44">' + L[1] + '</text>' +
    '<text class="pt" x="264" y="268">' + L[2] + '</text>' +
    '<text class="pt" x="36" y="268">' + L[3] + '</text>' +
    '<text class="pt" x="128" y="146">O</text>' +
    '</svg>';
  box.appendChild(wrap);
  var say = asay(box);
  var ol = el('ol','sqlog');
  var LOG = [
    'Квадрат: усі сторони рівні, усі кути прямі.',
    'Провели одну діагональ — вона ділить прямий кут навпіл: 45° і 45°.',
    'Друга діагональ: у центрі прямий кут, а кути при вершинах теж по 45°.',
    'Чотири трикутники рівні між собою — кожен рівнобедрений і прямокутний.'
  ];
  LOG.forEach(function(t,i){ if(i) ol.appendChild(el('li','hide')); });
  box.appendChild(ol);
  box.__paint = function(){
    var shown = 0;
    $$('li', ol).forEach(function(li,i){ if(li.classList.contains('on')) shown = i+1; });
    box.className = 'sqdiag s' + shown;
    say.textContent = LOG[shown];
    fit();
  };
  box.__paint();
});

/* ─────────────────────────────────────────────────────────────────────
   C20 · .lnk — ярлик і файл: що чому підпорядковане
   <div class="lnk" data-file="Море.png" data-place="Фото"></div>
   Видалили ярлик — файл на місці; видалили файл — ярлик став битим.
   ───────────────────────────────────────────────────────────────────── */
$$('.lnk').forEach(function(box){
  var name  = box.dataset.file  || 'Море.png',
      place = box.dataset.place || 'Фото';
  box.textContent = '';
  var wrap = el('div','lnw');
  wrap.innerHTML =
    '<div class="lbox"><span class="nm"><i></i>Диск · тека «' + place + '»</span>' +
      '<div class="slot"><span class="fchip file"><span class="ic"></span>' + name + '</span></div></div>' +
    '<div class="larr">↗</div>' +
    '<div class="lbox"><span class="nm"><i class="d"></i>Робочий стіл</span>' +
      '<div class="slot"><span class="fchip short"><span class="ic"></span>' + name +
      '<span class="badge">↗</span></span></div></div>';
  box.appendChild(wrap);
  var say = asay(box), row = arow(box);
  var file = $('.file', wrap), short = $('.short', wrap);

  function reset(){
    box.classList.remove('nofile','noshort');
    short.classList.remove('bad');
    $('.badge', short).textContent = '↗';
    say.textContent = 'Файл лежить у теці, а ярлик — лише стрілка-вказівник на нього.';
  }
  abtn(row, 'Видалити ярлик', '', function(){
    box.classList.add('noshort'); box.classList.remove('nofile');
    say.textContent = 'Ярлик зник — файл на місці. Ярлик не зберігає вміст, лише дорогу до нього.';
  });
  abtn(row, 'Видалити файл', '', function(){
    box.classList.add('nofile'); box.classList.remove('noshort');
    short.classList.add('bad'); $('.badge', short).textContent = '✕';
    say.textContent = 'Файл у Кошику — ярлик лишився, але став битим: веде в нікуди.';
  });
  abtn(row, 'Спочатку', 'q', reset);
  reset();
});


/* ─────────────────────────────────────────────────────────────────────
   C21 · .regroup — перегрупування: що куди переїхало
   <div class="regroup" data-from="6238 − (5238 + 120)"
                        data-to="(6238 − 5238) − 120"></div>
   Числа їдуть зі старого запису в новий, за ними тягнуться стрілки, а знак,
   який змінився, підсвічується. Показує те, чого не видно в готовому
   записі: куди подівся кожен доданок і чому «+» став «−».
   ───────────────────────────────────────────────────────────────────── */
$$('.regroup').forEach(function(box){
  var A = opTok(box.dataset.from || ''), B = opTok(box.dataset.to || '');
  if(!A || !B) return;
  box.textContent = '';

  function line(toks, cls){
    var d = el('div','rline ' + cls);
    toks.forEach(function(t,i){
      var e = el('span', t.k === 'o' ? 'op' : (t.k === 'n' ? 'n' : 'br'));
      e.textContent = opText(t);
      e.dataset.i = i;
      d.appendChild(e);
    });
    return d;
  }
  var l1 = line(A,'from'), l2 = line(B,'to');
  var arr = el('div','rarr');
  arr.innerHTML = '<svg preserveAspectRatio="none"><g></g></svg>';
  box.appendChild(l1); box.appendChild(arr); box.appendChild(l2);
  /* data-ans — необовʼязковий останній рядок: що вийшло після перестановки */
  var ans = null;
  if(box.dataset.ans){ ans = el('div','rans'); ans.textContent = box.dataset.ans; box.appendChild(ans); }
  var say = asay(box), row = arow(box);

  /* знак, який змінився: порівнюємо послідовності дій */
  var opsA = [], opsB = [];
  A.forEach(function(t,i){ if(t.k === 'o') opsA.push(i); });
  B.forEach(function(t,i){ if(t.k === 'o') opsB.push(i); });
  var changed = [];
  opsB.forEach(function(bi,k){
    if(opsA[k] != null && A[opsA[k]].v !== B[bi].v) changed.push(bi);
  });

  /* кожне число зі старого запису шукає себе в новому */
  var used = {}, pairs = [];
  $$('.n', l2).forEach(function(nb){
    var v = nb.textContent;
    var na = null;
    $$('.n', l1).forEach(function(x){ if(!na && !used[x.dataset.i] && x.textContent === v) na = x; });
    if(na){ used[na.dataset.i] = 1; pairs.push({a:na, b:nb}); }
  });

  var at = 0;
  function reset(){
    at = 0;
    box.classList.remove('done');
    $$('.ghost', box).forEach(function(g){ g.parentNode.removeChild(g); });
    $('g', arr).innerHTML = '';
    $$('.chg', l2).forEach(function(e){ e.classList.remove('chg'); });
    $$('.n', l1).forEach(function(e){ e.style.opacity = ''; });
    $$('.n', l2).forEach(function(e){ e.style.opacity = ''; });
    say.textContent = 'Дивимось, куди переїде кожне число — по одному.';
    fit();
  }
  /* По одному числу за крок — нічого не перемикається саме (вчитель, 25.09.2026). */
  function move(){
    if(at >= pairs.length){
      box.classList.add('done');
      changed.forEach(function(i){ var e = $('[data-i="' + i + '"]', l2); if(e) e.classList.add('chg'); });
      $$('.ghost', box).forEach(function(gh){ gh.parentNode.removeChild(gh); });
      say.textContent = 'Усе на місцях. Знак перед дужкою розійшовся на кожен доданок.';
      fit();
      return;
    }
    var br = box.getBoundingClientRect(), svg = $('svg', arr), g = $('g', arr);
    svg.setAttribute('viewBox', '0 0 ' + Math.round(br.width) + ' ' + Math.round(br.height));
    svg.style.width = br.width + 'px'; svg.style.height = br.height + 'px';
    svg.style.left = '0'; svg.style.top = '0';
    var p = pairs[at];
    var a = p.a.getBoundingClientRect(), b = p.b.getBoundingClientRect();
    var ax = a.left - br.left + a.width/2, ay = a.bottom - br.top;
    var bx = b.left - br.left + b.width/2, by = b.top - br.top;
    var my = (ay + by)/2;
    g.innerHTML += '<path class="rp" d="M ' + ax.toFixed(1) + ' ' + ay.toFixed(1) +
      ' C ' + ax.toFixed(1) + ' ' + my.toFixed(1) + ', ' + bx.toFixed(1) + ' ' + my.toFixed(1) +
      ', ' + bx.toFixed(1) + ' ' + by.toFixed(1) + '"></path>';
    var gh = el('span','ghost');
    gh.textContent = p.a.textContent;
    gh.style.left = (a.left - br.left) + 'px';
    gh.style.top  = (a.top  - br.top ) + 'px';
    box.appendChild(gh);
    setTimeout(function(){
      gh.style.transform = 'translate(' + (b.left - a.left) + 'px,' + (b.top - a.top) + 'px)';
    }, 30);
    p.a.style.opacity = '.25';
    p.b.style.opacity = '1';
    say.textContent = 'Число ' + p.a.textContent + ' переїхало на своє нове місце.';
    at++;
    fit();
  }
  abtn(row, 'Далі', '', move);
  abtn(row, 'Спочатку', 'q', reset);
  reset();
});


/* ─────────────────────────────────────────────────────────────────────
   C22 · .subst — підстановка значення: буква зникає, число стає на її місце
   <div class="subst" data-var="a" data-value="6" data-expr="9a − 7"></div>
   Перший пробіл — буква тане, на її місці спалахує число (і зʼявляється
   знак множення, якщо буква стояла біля числа). Далі — звичайні кроки
   обчислення, ті самі, що в .ordops.
   ───────────────────────────────────────────────────────────────────── */
$$('.subst').forEach(function(box){
  var V = box.dataset.var || 'a', VAL = box.dataset.value;
  /* data-list="Василь|9a − 7; Михайло|95 − 10a" — кілька виразів одного завдання:
     тоді кроки веде кнопка, а не пробіл (інакше на слайд лягло б 15 пробілів). */
  var LIST = (box.dataset.list || '').split(';')
    .map(function(x){ return x.trim(); }).filter(Boolean)
    .map(function(x){
      var p = x.split('|');
      return {lab: p.length > 1 ? p[0].trim() : '',
              ex: (p[1] || p[0]).trim(),
              cell: p[2] ? p[2].trim() : ''};   /* куди вписати відповідь */
    });
  var EX = box.dataset.expr || (LIST[0] ? LIST[0].ex : '');
  if(VAL == null || !EX){ return; }
  box.textContent = '';

  /* розбір виразу з буквою: число | буква | дія | дужка */
  function tok(ex){
    var T = [], i = 0;
    while(i < ex.length){
      var c = ex.charAt(i);
      if(c === ' '){ i++; continue; }
      if(c === V){ T.push({k:'v'}); i++; continue; }
      if(c >= '0' && c <= '9'){
        var j2 = i; while(j2 < ex.length && /[0-9.,]/.test(ex.charAt(j2))) j2++;
        T.push({k:'n', s: ex.slice(i,j2)}); i = j2; continue;
      }
      if('+-−·*×:/÷()'.indexOf(c) >= 0){ T.push({k:'o', s:c}); i++; continue; }
      i++;
    }
    return T;
  }
  /* вираз після підстановки: біля числа дописуємо знак множення */
  function subst(T){
    var out = '';
    T.forEach(function(t,k){
      if(t.k === 'v'){
        var pr = T[k-1];
        if(pr && (pr.k === 'n' || (pr.k === 'o' && pr.s === ')'))) out += ' · ';
        out += VAL;
      } else out += (t.s === '(' || t.s === ')' ? t.s : ' ' + t.s + ' ');
    });
    return out;
  }
  var T = tok(EX), F = opFrames(opTok(subst(T)));

  var view = el('div','sv'), say = asay(box), ol = el('ol','olog');
  box.appendChild(view); box.appendChild(say); box.appendChild(ol);
  /* кроків: один на підстановку + стільки, скільки дій у виразі */
  var STEPS = F.length;                         /* F[0] — вираз із числом, далі дії */
  for(var k = 0; k < STEPS; k++) ol.appendChild(el('li','hide'));

  function drawStart(){
    view.innerHTML = '';
    T.forEach(function(t){
      var e = el('span', t.k === 'v' ? 'v' : (t.k === 'o' ? 'o' : ''));
      e.textContent = t.k === 'v' ? V : t.s;
      view.appendChild(e);
    });
  }
  function drawFrame(n, pop){
    var f = F[n];
    view.innerHTML = '';
    var i2 = 0;
    while(i2 < f.t.length){
      var e;
      if(f.act && i2 === f.act[0]){
        e = el('span','act'); e.textContent = opJoin(f.t, f.act[0], f.act[1]); i2 = f.act[1] + 1;
      } else {
        e = el('span', f.t[i2].k === 'o' ? 'o' : '');
        if(i2 === f.nw && pop) e.className += ' nw';
        if(f.t.length === 1) e.className += ' fin';
        e.textContent = opText(f.t[i2]); i2++;
      }
      view.appendChild(e);
    }
  }
  if(LIST.length){
    /* Кілька виразів одного завдання. КОЖЕН крок — окремий пробіл, нічого не
       перемикається само (вчитель, 25.09.2026): підстановка — крок, кожна дія —
       крок. Коли вираз дорахований, відповідь сама стає в клітинку таблиці
       (третє поле в data-list). */
    var lab = el('div','slab');
    box.insertBefore(lab, view);
    var ITEM = LIST.map(function(it){
      var tt = tok(it.ex);
      return {lab: it.lab, cell: it.cell, T: tt, F: opFrames(opTok(subst(tt)))};
    });
    /* Кроків на вираз: показати його З БУКВОЮ, підставити число, далі кожна дія.
       Крок із буквою обовʼязковий — інакше клас не бачить, що саме підставляють. */
    ol.innerHTML = '';
    ITEM.forEach(function(it, idx){
      it.steps = it.F.length + (idx ? 1 : 0);   /* перший вираз уже видно з буквою */
      for(var k = 0; k < it.steps; k++) ol.appendChild(el('li','hide'));
    });
    box.__at = -1;
    box.__paint = function(){
      var shown = 0;
      $$('li', ol).forEach(function(li){ if(li.classList.contains('on')) shown++; });
      if(shown === box.__at) return;
      var pop = shown > box.__at;
      box.__at = shown;
      if(shown <= 0){                      /* нічого не відкрито — перший вираз із буквою */
        T = ITEM[0].T; F = ITEM[0].F; lab.textContent = ITEM[0].lab;
        box.classList.remove('gone'); drawStart();
        say.textContent = 'Замість ' + V + ' ставимо ' + VAL + '.';
        fit(); return;
      }
      /* знайти, чий це вираз і який крок усередині нього */
      var k = 0, left = shown;
      while(k < ITEM.length - 1 && left > ITEM[k].steps){ left -= ITEM[k].steps; k++; }
      var it = ITEM[k], off = k ? 1 : 0;    /* у наступних виразів перший крок — буква */
      T = it.T; F = it.F; lab.textContent = it.lab;
      if(off && left <= 1){
        box.classList.remove('gone'); drawStart();
        say.textContent = (it.lab ? it.lab + ': ' : '') + 'замість ' + V + ' ставимо ' + VAL + '.';
        fit(); return;
      }
      box.classList.add('gone');
      var n = Math.max(0, Math.min(F.length - 1, left - 1 - off));
      drawFrame(n, pop);
      say.textContent = (left - off) === 1 ? 'Буква зникла — на її місці ' + VAL + '.'
                                           : (F[n].say || '');
      if(left >= it.steps && it.cell){
        var c = D.querySelector(it.cell);
        if(c){ c.textContent = anum(F[F.length-1].t[0].v); c.classList.add('ans','on'); }
      }
      fit();
    };
    lab.textContent = ITEM[0].lab;
    T = ITEM[0].T; F = ITEM[0].F;
    drawStart();
    say.textContent = 'Замість ' + V + ' ставимо ' + VAL + '.';
    return;
  }
  box.__at = -1;
  box.__paint = function(){
    var shown = 0;
    $$('li', ol).forEach(function(li){ if(li.classList.contains('on')) shown++; });
    if(shown > STEPS) shown = STEPS;
    var pop = shown !== box.__at;
    /* крок 0 — ще буква; крок 1 — щойно підставили; далі — обчислення */
    if(shown === 0){
      box.classList.remove('gone');
      drawStart();
      say.textContent = 'Замість букви ' + V + ' скрізь ставимо її значення — ' + VAL + '.';
    } else {
      if(pop && shown === 1){
        /* спершу буква тане, і лише потім на її місці число */
        box.classList.add('gone');
        setTimeout(function(){ if(box.__at === 1){ drawFrame(0, true); } }, 260);
        say.textContent = 'Буква зникла — на її місці число ' + VAL + '.';
      } else {
        drawFrame(shown - 1, pop);
        say.textContent = F[shown-1].say || '';
      }
    }
    box.__at = shown;
    fit();
  };
  box.__paint();
});

/* ─────────────────────────────────────────────────────────────────────
   C23 · .jump — стрибки по числовій прямій: який знак ставимо замість ✳
   <div class="jump" data-start="120" data-steps="50,70,30,100"
        data-target="170" data-unit=""></div>
   Клас каже знак, учитель тисне «+» або «−» — стрибок малюється дугою,
   і видно, чи прилетіли в ціль. Мінус, що завів би нижче нуля, не дається:
   у 5 класі від меншого числа більше не віднімаємо.
   ───────────────────────────────────────────────────────────────────── */
$$('.jump').forEach(function(box){
  var st0 = parseFloat(box.dataset.start) || 0,
      tgt = parseFloat(box.dataset.target);
  var NV = (box.dataset.steps || '').split(',').map(function(x){
    return Math.abs(parseFloat(x.replace('−','-').replace(/\s/g,'')));
  }).filter(function(x){ return !isNaN(x); });
  if(!NV.length) return;
  var N = NV.length, tot = NV.reduce(function(a,b){ return a+b; }, 0);
  var HI = Math.max(st0 + tot, isNaN(tgt) ? 0 : tgt), LO = 0;
  var W0 = 40, W1 = 660, Y = 116;
  function X(v){ return W0 + (W1 - W0) * (v - LO) / (HI - LO || 1); }
  /* крок поділок: щоб їх було 6…14 */
  var stp = 10; [10,20,25,50,100,200,250,500].some(function(k){
    stp = k; return (HI - LO) / k <= 14;
  });

  box.textContent = '';
  var xr = el('div','jx'); box.appendChild(xr);
  var svg = el('div');
  var ticks = '';
  for(var t = LO; t <= HI + 1e-9; t += stp){
    ticks += '<line class="tk" x1="' + X(t) + '" y1="' + (Y - 7) + '" x2="' + X(t) + '" y2="' + (Y + 7) + '"></line>' +
             '<text class="tl" x="' + X(t) + '" y="' + (Y + 26) + '">' + anum(t) + '</text>';
  }
  var goal = isNaN(tgt) ? '' :
    '<line class="goal" x1="' + X(tgt) + '" y1="' + (Y - 40) + '" x2="' + X(tgt) + '" y2="' + (Y + 34) + '"></line>' +
    '<text class="goalt" x="' + X(tgt) + '" y="' + (Y + 56) + '">ціль ' + anum(tgt) + '</text>';
  svg.innerHTML =
    '<svg viewBox="0 0 700 172" role="img" aria-label="Числова пряма зі стрибками">' +
      '<g class="arcs"></g>' + ticks + goal +
      '<line class="ax" x1="' + W0 + '" y1="' + Y + '" x2="' + (W1 + 14) + '" y2="' + Y + '"></line>' +
      '<path class="ax" d="M' + (W1 + 14) + ' ' + Y + ' l-11 -6 v12 z" style="fill:currentColor"></path>' +
      '<circle class="dot" cx="' + X(st0) + '" cy="' + Y + '" r="8"></circle>' +
    '</svg>';
  box.appendChild(svg.firstChild);
  var sv = $('svg', box), arcs = $('.arcs', sv), dot = $('.dot', sv);
  var say = asay(box), row = arow(box);

  var sg = [], cur = st0;                   /* sg[i] = +1 / −1, поки не обрано — немає */

  function expr(){
    var h = '<span>' + anum(st0) + '</span>';
    for(var i = 0; i < N; i++){
      h += (sg[i] === undefined
              ? '<span class="st' + (i === sg.length ? ' act' : '') + '">✳</span>'
              : '<span class="sg">' + (sg[i] > 0 ? '+' : '−') + '</span>') +
           '<span>' + anum(NV[i]) + '</span>';
    }
    if(!isNaN(tgt)) h += '<span class="sg"> = </span><span class="tg">' + anum(tgt) + '</span>';
    xr.innerHTML = h;
  }
  function arc(i, from, to, sign){
    var x1 = X(from), x2 = X(to), mid = (x1 + x2) / 2, h = Y - 30 - Math.min(24, Math.abs(x2 - x1) / 7);
    var p = D.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('class','arc on');
    p.setAttribute('d','M' + x1 + ' ' + (Y - 10) + ' Q' + mid + ' ' + h + ' ' + x2 + ' ' + (Y - 10));
    var len = 0; try{ len = p.getTotalLength(); }catch(e){}
    p.style.setProperty('--len', (len || Math.abs(x2 - x1) * 1.4) + 'px');
    arcs.appendChild(p);
    var a = D.createElementNS('http://www.w3.org/2000/svg','path');
    a.setAttribute('class','ah on');
    a.setAttribute('d', sign > 0 ? 'M' + x2 + ' ' + (Y - 8) + ' l-10 -9 l14 1 z'
                                 : 'M' + x2 + ' ' + (Y - 8) + ' l10 -9 l-14 1 z');
    arcs.appendChild(a);
    var l = D.createElementNS('http://www.w3.org/2000/svg','text');
    l.setAttribute('class','alab on'); l.setAttribute('x', mid); l.setAttribute('y', h - 4);
    l.textContent = (sign > 0 ? '+' : '−') + anum(NV[i]);
    arcs.appendChild(l);
  }
  function redraw(){
    arcs.innerHTML = '';
    var v = st0;
    for(var i = 0; i < sg.length; i++){ var nx = v + sg[i] * NV[i]; arc(i, v, nx, sg[i]); v = nx; }
    cur = v;
    dot.setAttribute('cx', X(cur));
    var hit = sg.length === N && !isNaN(tgt) && cur === tgt;
    dot.classList.toggle('hit', hit);
    expr(); fit();
  }
  function put(sign){
    var i = sg.length;
    if(i >= N){ say.textContent = 'Усі знаки вже стоять. «Крок назад» — і пробуємо інакше.'; return; }
    if(sign < 0 && cur - NV[i] < 0){
      say.textContent = 'Мінус тут не підходить: від ' + anum(cur) + ' відняти ' + anum(NV[i]) +
                        ' не можемо — у 5 класі від меншого більше не віднімаємо.';
      return;
    }
    sg.push(sign); redraw();
    if(sg.length < N){
      say.textContent = (sign > 0 ? 'Стрибок вправо на ' : 'Стрибок уліво на ') + anum(NV[i]) +
                        ': тепер ми на ' + anum(cur) + '.';
    } else if(isNaN(tgt)){
      say.textContent = 'Прилетіли в ' + anum(cur) + '.';
    } else if(cur === tgt){
      say.textContent = 'Влучили: ' + anum(cur) + ' = ' + anum(tgt) + '. Знаки підібрані.';
    } else {
      say.textContent = 'Промах: ' + anum(cur) + ' замість ' + anum(tgt) + '. Різниця ' +
                        anum(Math.abs(cur - tgt)) + ' — шукаємо, який знак повернути.';
    }
  }
  abtn(row, '+', '', function(){ put(1); });
  abtn(row, '−', '', function(){ put(-1); });
  abtn(row, 'Крок назад', 'q', function(){
    if(!sg.length){ say.textContent = 'Ще жодного знака не поставили.'; return; }
    sg.pop(); redraw();
    say.textContent = 'Забрали останній знак — стоїмо на ' + anum(cur) + '.';
  });
  abtn(row, 'Спочатку', 'q', function(){
    sg = []; redraw();
    say.textContent = 'Починаємо з ' + anum(st0) + '. Який знак замість першої зірочки?';
  });
  redraw();
  say.textContent = 'Починаємо з ' + anum(st0) + '. Який знак замість першої зірочки?';
});

/* ─────────────────────────────────────────────────────────────────────
   C24 · .sgn — мінус виходить зі знаменника
   <div class="sgn" data-num="5" data-den="1 − x"></div>
   Два кроки пробілом. Перший: доданки в знаменнику міняються місцями, і
   за це перед дужкою стає мінус. Другий: мінус виходить зі знаменника
   перед дріб. Учень має побачити, чому a − b і b − a — це той самий
   знаменник з точністю до знака, і чому після цього дроби можна додавати.
   ───────────────────────────────────────────────────────────────────── */
$$('.sgn').forEach(function(box){
  var num   = box.dataset.num || 'a',
      den   = box.dataset.den || '1 − x',
      parts = den.split(/\s*[−–—-]\s*/);
  if(parts.length < 2) return;
  var A = parts[0].trim(), B = parts[1].trim();

  box.textContent = '';
  var view = el('div','sview');
  view.innerHTML =
    '<span class="lead">−</span>' +
    '<span class="fr"><span class="n">' + num + '</span>' +
    '<span class="d"><span class="den">' +
      '<span class="mn"></span><span class="br"></span>' +
      '<span class="tok ta"></span><span class="op"> − </span><span class="tok tb"></span>' +
      '<span class="br2"></span>' +
    '</span></span></span>';
  box.appendChild(view);

  var rule = el('div','rule');
  rule.innerHTML = A + ' − ' + B + ' = <b>−(' + B + ' − ' + A + ')</b>';
  box.appendChild(rule);

  var say = asay(box);

  /* два порожні кроки: пробіл відкриває їх по одному, як будь-яку відповідь */
  var marks = el('div','sgm');
  marks.innerHTML = '<i class="hide"></i><i class="hide"></i>';
  box.appendChild(marks);

  var lead = $('.lead', view), mn = $('.mn', view), br = $('.br', view),
      br2 = $('.br2', view), dn = $('.den', view),
      ta = $('.ta', view), tb = $('.tb', view);

  var TXT = [
    'Знаменник ' + A + ' − ' + B + ', а в сусідньому дробі — ' + B + ' − ' + A + '. Знаменники протилежні.',
    'Міняємо доданки місцями. Щоб вираз не змінився, перед дужкою ставимо мінус.',
    'Мінус зі знаменника виносимо перед дріб — тепер знаменники однакові.'
  ];

  box.__at = -1;
  box.__paint = function(){
    var n = 0;
    $$('i.hide', marks).forEach(function(i){ if(i.classList.contains('on')) n++; });
    if(n === box.__at) return;
    var was = box.__at;
    box.__at = n;

    var o1 = ta.getBoundingClientRect(), o2 = tb.getBoundingClientRect();

    ta.textContent = n >= 1 ? B : A;
    tb.textContent = n >= 1 ? A : B;
    mn.textContent  = n === 1 ? '−' : '';
    br.textContent  = n === 1 ? '(' : '';
    br2.textContent = n === 1 ? ')' : '';
    dn.classList.toggle('neg', n === 1);
    lead.classList.toggle('on', n >= 2);
    ta.classList.toggle('act', n === 1);
    tb.classList.toggle('act', n === 1);
    ta.classList.toggle('nw', n >= 2);
    tb.classList.toggle('nw', n >= 2);
    say.textContent = TXT[n > 2 ? 2 : n];

    /* доданки справді переїжджають місцями, а не просто перемальовуються */
    if(was === 0 && n === 1 && o1.width){
      var n1 = ta.getBoundingClientRect(), n2 = tb.getBoundingClientRect();
      ta.style.transition = 'none'; tb.style.transition = 'none';
      ta.style.transform = 'translateX(' + (o2.left - n1.left) + 'px)';
      tb.style.transform = 'translateX(' + (o1.left - n2.left) + 'px)';
      requestAnimationFrame(function(){
        ta.style.transition = ''; tb.style.transition = '';
        ta.style.transform = '';  tb.style.transform = '';
      });
    } else {
      ta.style.transform = ''; tb.style.transform = '';
    }
    fit();
  };
  box.__paint();
});

/* ─────────────────────────────────────────────────────────────────────
   A11 · загальний таймер уроку
   Урок фактично 40 хв (вчитель, 18.09.2026: «не встигаємо»), тому основна
   лінія планується на 35 хв, а тут видно, скільки лишилось до дзвінка.
   Інша тривалість — атрибутом data-lesson="35" на <html>.
   Клік по чипу або U — почати / пауза; подвійний клік або Shift+U — спочатку.
   Час рахуємо від мітки Date.now(), а не лічильником тиків: у фоновій
   вкладці setInterval гальмує, і чип відставав би від справжнього дзвінка.
   ───────────────────────────────────────────────────────────────────── */
var LES_MIN  = parseFloat(root.dataset.lesson) || 40;
var LES_ALL  = LES_MIN * 60;
var LES_WARN = 300;                       /* останні 5 хв — бурштин */
var LES_KEY  = KEY + ':lesson';
var lesBox = null, lesAcc = 0, lesT0 = 0, lesRun = false, lesInt = null, lesTouched = false;

function lesSpent(){ return lesAcc + (lesRun ? (Date.now() - lesT0) / 1000 : 0); }
function lesPaint(){
  if(!lesBox) return;
  var left = LES_ALL - lesSpent(), over = left < -0.5, a = Math.abs(Math.round(left));
  $('.m', lesBox).textContent = (over ? '−' : '') + Math.floor(a / 60);
  $('.s', lesBox).textContent = ('0' + (a % 60)).slice(-2);
  $('.cap', lesBox).textContent = (!lesRun && lesTouched) ? 'пауза' : 'урок';
  lesBox.classList.toggle('run',  lesRun);
  lesBox.classList.toggle('idle', !lesTouched);
  lesBox.classList.toggle('warn', !over && left <= LES_WARN);
  lesBox.classList.toggle('over', over);
}
function lesSave(){
  ls(LES_KEY, JSON.stringify({ a: Math.round(lesSpent()), r: lesRun ? 1 : 0, at: Date.now() }));
}
function lesBeat(go){
  if(lesInt){ clearInterval(lesInt); lesInt = null; }
  if(go) lesInt = setInterval(function(){ lesPaint(); lesSave(); }, 500);
}
function lesStart(){
  if(lesRun || !lesBox) return;
  lesRun = true; lesTouched = true; lesT0 = Date.now();
  lesBeat(true); lesPaint(); lesSave();
}
function lesPause(){
  if(!lesRun) return;
  lesAcc = lesSpent(); lesRun = false; lesT0 = 0;
  lesBeat(false); lesPaint(); lesSave();
}
function lesToggle(){ if(lesRun) lesPause(); else lesStart(); }
function lesReset(){
  lesAcc = 0; lesT0 = 0; lesRun = false; lesTouched = false;
  lesBeat(false); lesPaint(); lsDel(LES_KEY);
}
/* Перший рух по слайдах = урок почався: вчителеві не треба пам'ятати
   ще про одну клавішу перед класом. */
function lesAuto(){ if(lesBox && !lesTouched) lesStart(); }

(function(){
  var host = topic || bar;
  if(!host) return;
  lesBox = el('button','lesson');
  lesBox.id = 'lesson';
  lesBox.type = 'button';
  lesBox.title = 'Таймер уроку · ' + LES_MIN + ' хв (U) — клік: почати / пауза, подвійний клік: спочатку';
  lesBox.innerHTML = '<span class="cap">урок</span>' +
    '<span class="cl"><b class="m">0</b><i>:</i><b class="s">00</b></span>';
  host.appendChild(lesBox);
  on(lesBox,'click',function(e){ e.stopPropagation(); lesToggle(); });
  on(lesBox,'dblclick',function(e){ e.stopPropagation(); lesReset(); });
  try{
    var st = JSON.parse(ls(LES_KEY) || 'null');
    /* Відкрили той самий дек іншого дня — старий відлік не тягнемо. */
    if(st && Date.now() - st.at < 3 * 3600e3){
      lesTouched = true;
      lesAcc = st.a + (st.r ? (Date.now() - st.at) / 1000 : 0);
      if(st.r){ lesRun = true; lesT0 = Date.now(); lesBeat(true); }
    } else if(st) lsDel(LES_KEY);
  }catch(err){}
  lesPaint();
})();
on(D,'visibilitychange',function(){ if(!D.hidden) lesPaint(); });

/* ─────────────────────────────────────────────────────────────────────
   керування
   ───────────────────────────────────────────────────────────────────── */
function fsToggle(){
  if(D.fullscreenElement) D.exitFullscreen();
  else root.requestFullscreen && root.requestFullscreen();
}
function bind(id,fn){ var b = $('#'+id); if(b) on(b,'click',function(e){ e.stopPropagation(); fn(); }); }
bind('next',next); bind('prev',prev); bind('fs',fsToggle);
bind('btnOv',toggleOv); bind('btnHelp',openHelp); bind('btnTh',cycleTheme);
bind('btnInk',function(){ setInk(inkMode === 'off' ? 'pen' : 'off'); });

var downXY = null;
on(sheet,'pointerdown',function(e){ downXY = [e.clientX, e.clientY]; });
on(sheet,'click',function(e){
  if(e.target.closest && e.target.closest('button, a, input, textarea, .numline, .quiz, .roster, .mode.pick, details')) return;
  /* тягнули мишею — це виділення тексту, а не «далі» */
  if(downXY){
    var dx = e.clientX - downXY[0], dy = e.clientY - downXY[1];
    downXY = null;
    if(dx*dx + dy*dy > 36) return;
  }
  var sel = W.getSelection && W.getSelection();
  if(sel && !sel.isCollapsed && String(sel).trim()) return;
  next();
});

on(D,'keydown',function(e){
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(D.activeElement && D.activeElement.tagName)) return;
  if(D.querySelector('dialog[open]') && e.code !== 'Escape') return;
  var k = e.code;
  if(e.key === '?'){ e.preventDefault(); openHelp(); return; }
  if(k === 'Escape'){
    if(ov.classList.contains('on')){ e.preventDefault(); closeOv(); return; }
    if(inkMode !== 'off'){ e.preventDefault(); setInk('off'); return; }
    if(black.style.display === 'block'){ e.preventDefault(); toggleBlack(); return; }
    return;
  }
  if(ov.classList.contains('on')) return;
  if(k === 'ArrowRight' || k === 'Space' || k === 'PageDown' || k === 'Enter'){ e.preventDefault(); next(); }
  else if(k === 'ArrowLeft' || k === 'PageUp'){ e.preventDefault(); prev(); }
  else if(k === 'Home'){ e.preventDefault(); go(0,false); }
  else if(k === 'End'){ e.preventDefault(); go(slides.length-1,true); }
  else if(k === 'KeyO'){ e.preventDefault(); toggleOv(); }
  else if(k === 'KeyT'){ var b = $('.timer', slides[cur]); if(b){ e.preventDefault(); toggleTimer(b); } }
  else if(k === 'KeyU'){ e.preventDefault(); if(e.shiftKey) lesReset(); else lesToggle(); }
  else if(k === 'KeyF'){ e.preventDefault(); fsToggle(); }
  else if(k === 'KeyD'){ e.preventDefault(); setInk(inkMode === 'pen' ? 'off' : 'pen'); }
  else if(k === 'KeyL'){ e.preventDefault(); setInk(inkMode === 'laser' ? 'off' : 'laser'); }
  else if(k === 'KeyC'){ e.preventDefault(); clearInk(); }
  else if(k === 'KeyB'){ e.preventDefault(); toggleBlack(); }
  else if(k === 'KeyY'){ e.preventDefault(); cycleTheme(); }
  else if(k === 'KeyP'){ e.preventDefault(); toggleProj(); }
});

/* ─────────────────────────────────────────────────────────────────────
   старт
   ───────────────────────────────────────────────────────────────────── */
slides.forEach(function(s){ resetTimer(s); syncSteps(s); });
slides.forEach(function(s,i){ if(i !== 0) s.classList.remove('on'); });
slides[0].classList.add('on');
var st = startIndex();
if(st.i) applyState(st.i,false); else paint();
if(st.ask !== false) offerResume(st.ask);
remember();
setTimeout(fit, 60);

})();
