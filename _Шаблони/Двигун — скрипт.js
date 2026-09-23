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

  if(count) count.textContent = (cur+1) + ' / ' + slides.length;
  if(tip){
    var all = $$('.hide', s).length, shown = shownOf(cur).length;
    if(all){ tip.textContent = 'показано ' + shown + ' з ' + all; tip.classList.add('on'); }
    else { tip.textContent = ''; tip.classList.remove('on'); }
  }
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
  $$('.colsub', s).forEach(function(b){ if(b.__paint) b.__paint(); });
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
  var left = el('div','left');
  box.appendChild(win); box.appendChild(go2); box.appendChild(again); box.appendChild(left);

  var all = [], pool = [];
  for(var n = from; n <= to; n++) all.push(n);
  function fresh(){ pool = all.slice(); say(); }
  function say(){ left.textContent = 'ще не питали: ' + pool.length + ' з ' + all.length +
                                    ' (№ ' + from + '–' + to + ')'; }
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
