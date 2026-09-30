#!/usr/bin/env python3
"""
Запасні стилі для старих браузерів — iOS 12 / Android 5 / Chrome на Windows 7.

    python3 tools/сумісність.py "шлях.html" ["шлях2.html" ...]

Править файл НА МІСЦІ й ідемпотентно: попередні вставки (між /*compat{*/ і
/*}compat*/) спершу вирізаються, потім генеруються заново. Шаблони й джерело
двигуна лишаються чистими — інструмент кличуть update_decks.py (деки),
бойова_копія.py і резерв.py (роботи), build_index.py (сайт).

ЩО РОБИТЬ. Старий рушій не знає частини сучасного CSS і мовчки викидає таке
оголошення цілком. Тому одразу після кожного правила, де є новинка, дописуємо
    @supports not (<новинка>) { той самий селектор { запасне значення } }
Саме @supports, а не «запасне значення рядком вище»: якщо в значенні є var(),
старий рушій приймає його під час розбору й бракує лише при обчисленні — і
тоді властивість стає unset, а рядок вище вже не рятує.

    clamp(a,b,c)       → a (нижня межа — вона й задумана для малих екранів)
    min()/max()        → відносний / фіксований аргумент
    env(x, f)          → f
    oklch(...)         → rgb(...), тон --h береться з data-subject сторінки
    color-mix(...)     → переважний колір суміші
    inset              → top/right/bottom/left
    padding-block/…    → padding-top/bottom, -left/right (так само margin, inset-*)
    gap у гратці        → grid-gap (Chrome < 66)
    gap у флексі        → відступи дітям під класом .no-fgap на <html>;
                         клас ставить маленький ES5-скрипт у <head>, бо
                         флекс-gap (Safari 14.1) через @supports не виявити

Чого НЕ робить: inline-стилі в атрибутах і стилі, які ставить JS, — їх
лишено як є. aspect-ratio і <dialog> полагоджено руками в джерелах.
"""
import math
import re
import sys

import tinycss2

MARK_OPEN, MARK_CLOSE = '/*compat{*/', '/*}compat*/'
GEN_RE = re.compile(re.escape(MARK_OPEN) + r'.*?' + re.escape(MARK_CLOSE), re.S)
SCRIPT_ID = 'compat-fgap'
SCRIPT_RE = re.compile(r'\n?<script id="%s">.*?</script>' % SCRIPT_ID, re.S)

SUBJECT_H = {'math': 258, 'algebra': 300, 'geometry': 150, 'informatics': 40}

TEST = {
    'clamp': '(width:clamp(1px,2px,3px))',
    'min': '(width:min(1px,2px))',
    'env': '(padding:env(safe-area-inset-top,1px))',
    'oklch': '(color:oklch(50% .1 200))',
    'color-mix': '(color:color-mix(in srgb,red,blue))',
    'inset': '(inset:0)',
    'gap': '(gap:1px)',
    'logical': '(padding-block:1px)',
}

# логічні скорочення (Safari 14.1 / Chrome 87) → звичайні сторони (письмо зліва направо)
LOGICAL = {}
for _p in ('padding', 'margin'):
    LOGICAL[_p + '-block'] = (_p + '-top', _p + '-bottom')
    LOGICAL[_p + '-inline'] = (_p + '-left', _p + '-right')
LOGICAL['inset-block'] = ('top', 'bottom')
LOGICAL['inset-inline'] = ('left', 'right')

# ES5 навмисно: цей шматок мусить вижити там, де все сучасне вже впало.
FGAP_SCRIPT = ('<script id="%s">/* флекс-gap з Safari 14.1: де його нема, '
               'стилі дають дітям відступи (tools/сумісність.py) */'
               '(function(){try{var d=document.createElement("div"),r=document.documentElement;'
               'd.style.cssText="display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden";'
               'd.appendChild(document.createElement("div"));d.appendChild(document.createElement("div"));'
               'r.appendChild(d);var ok=d.scrollHeight===1;r.removeChild(d);'
               'if(!ok)r.className+=" no-fgap";}catch(e){}})();</script>' % SCRIPT_ID)


# ───────────────────────── розбір CSS на правила ─────────────────────────
def _skip(css, i):
    """Пропустити коментар або рядок, що починається з i; інакше None."""
    if css.startswith('/*', i):
        j = css.find('*/', i + 2)
        return len(css) if j < 0 else j + 2
    if css[i] in '"\'':
        q, j = css[i], i + 1
        while j < len(css) and css[j] != q:
            j += 2 if css[j] == '\\' else 1
        return j + 1
    return None


def _match(css, i):
    """i стоїть на '{' — повертає індекс відповідної '}'."""
    depth = 0
    while i < len(css):
        k = _skip(css, i)
        if k is not None:
            i = k
            continue
        if css[i] == '{':
            depth += 1
        elif css[i] == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return len(css) - 1


def blocks(css, start=0, end=None, ctx=()):
    """Плоский список правил: (prelude, body_start, body_end, ctx).
    ctx — ланцюжок обгорток (@media ...), в яких лежить правило."""
    end = len(css) if end is None else end
    out, i, pre = [], start, start
    while i < end:
        k = _skip(css, i)
        if k is not None:
            if css.startswith('/*', i) and not css[pre:i].strip():
                pre = k            # коментар перед селектором — не частина його
            i = k
            continue
        c = css[i]
        if c == ';':
            pre = i + 1
        elif c == '{':
            close = _match(css, i)
            prelude = css[pre:i].strip()
            if prelude.startswith('@'):
                name = prelude.split(None, 1)[0].lower()
                if name == '@media':
                    out += blocks(css, i + 1, close, ctx + (prelude,))
                # @supports, @keyframes, @font-face… — усередину не ліземо
            else:
                out.append((prelude, i + 1, close, ctx))
            i = close + 1
            pre = i
            continue
        i += 1
    return out


def decls(body):
    """Оголошення тіла правила: [(name, value, important)]; None, якщо там вкладені правила."""
    if '{' in body:
        return None
    out = []
    for d in tinycss2.parse_declaration_list(body, skip_comments=True, skip_whitespace=True):
        if d.type == 'declaration':
            out.append((d.lower_name if not d.name.startswith('--') else d.name,
                        tinycss2.serialize(d.value).strip(), d.important))
    return out


# ───────────────────────── кольори ─────────────────────────
def oklch_to_rgb(L, C, H, A=None):
    a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    lin = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)

    def enc(x):
        x = max(0.0, min(1.0, x))
        x = 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
        return round(x * 255)
    r, g, bl = (enc(x) for x in lin)
    if A is None or A >= 1:
        return '#%02x%02x%02x' % (r, g, bl)
    return 'rgba(%d,%d,%d,%s)' % (r, g, bl, ('%.3f' % A).rstrip('0').rstrip('.'))


def _num(tok):
    if tok.type == 'percentage':
        return tok.value / 100
    if tok.type == 'number':
        return tok.value
    raise ValueError


# ───────────────────────── перетворення значень ─────────────────────────
REL = re.compile(r'(%|vw|vh|vmin|vmax|var\(--u\))')


class Unresolved(Exception):
    pass


def _args(fn):
    """Аргументи функції, розбиті комами, без крайових пробілів."""
    parts, cur = [], []
    for t in fn.arguments:
        if t.type == 'literal' and t.value == ',':
            parts.append(cur)
            cur = []
        else:
            cur.append(t)
    parts.append(cur)
    return [_strip(p) for p in parts]


def _strip(toks):
    while toks and toks[0].type in ('whitespace', 'comment'):
        toks = toks[1:]
    while toks and toks[-1].type in ('whitespace', 'comment'):
        toks = toks[:-1]
    return toks


def _ser(toks):
    return tinycss2.serialize(toks).strip()


class Low:
    """Знижує значення до того, що розуміє старий рушій; збирає, які новинки знадобились."""

    def __init__(self, vars_):
        self.vars = vars_
        self.used = set()

    def resolve(self, toks, depth=0):
        """Підставити var() — лише для обчислення oklch."""
        out = []
        for t in toks:
            if t.type == 'function' and t.lower_name == 'var':
                a = _args(t)
                name = _ser(a[0])
                if name in self.vars and depth < 8:
                    out += self.resolve(tinycss2.parse_component_value_list(self.vars[name]), depth + 1)
                elif len(a) > 1:
                    out += self.resolve(a[1], depth + 1)
                else:
                    raise Unresolved(name)
            else:
                out.append(t)
        return out

    def oklch(self, fn):
        toks = [t for t in self.resolve(fn.arguments) if t.type not in ('whitespace', 'comment')]
        alpha = None
        if any(t.type == 'literal' and t.value == '/' for t in toks):
            k = next(i for i, t in enumerate(toks) if t.type == 'literal' and t.value == '/')
            alpha = _num(toks[k + 1])
            toks = toks[:k]
        L, C, H = (_num(t) for t in toks[:3])
        if toks[1].type == 'percentage':      # C у відсотках: 100% = 0.4
            C = C * 0.4
        return oklch_to_rgb(L, C, H, alpha)

    def value(self, toks):
        out = []
        for t in toks:
            if t.type != 'function':
                out.append(t)
                continue
            n = t.lower_name
            if n == 'clamp':
                self.used.add('clamp')
                out += self.value(_args(t)[0])
            elif n in ('min', 'max'):
                self.used.add('min')
                a = [self.value(x) for x in _args(t)]
                rel = [x for x in a if REL.search(_ser(x))]
                fix = [x for x in a if not REL.search(_ser(x))]
                pick = (rel or a)[0] if n == 'min' else (fix or a)[0]
                out += pick
            elif n == 'env':
                self.used.add('env')
                a = _args(t)
                out += self.value(a[1]) if len(a) > 1 else tinycss2.parse_component_value_list('0px')
            elif n == 'oklch':
                self.used.add('oklch')
                try:
                    out += tinycss2.parse_component_value_list(self.oklch(t))
                except (Unresolved, ValueError, IndexError, StopIteration):
                    raise Unresolved('oklch')
            elif n == 'color-mix':
                self.used.add('color-mix')
                parts = _args(t)[1:]          # перший аргумент — «in srgb»
                best, best_p = None, -1
                for i, p in enumerate(parts):
                    pct = [x for x in p if x.type == 'percentage']
                    col = [x for x in p if x.type != 'percentage']
                    w = pct[0].value if pct else (100 - _pct_other(parts, i))
                    if w > best_p:
                        best, best_p = _strip(col), w
                out += self.value(best)
            else:
                inner = self.value(t.arguments)
                out.append(tinycss2.ast.FunctionBlock(t.source_line, t.source_column, t.name, inner))
        return out


def _pct_other(parts, i):
    for j, p in enumerate(parts):
        if j != i:
            pct = [x for x in p if x.type == 'percentage']
            return pct[0].value if pct else 50
    return 50


def lower(value, vars_):
    """(нове_значення, {новинки}) або None, якщо знижувати нічого/неможливо."""
    lo = Low(vars_)
    try:
        toks = lo.value(tinycss2.parse_component_value_list(value))
    except Unresolved:
        return None
    if not lo.used:
        return None
    return _ser(toks), lo.used


def _sides(v):
    p = v.split()
    if len(p) == 1:
        p = p * 4
    elif len(p) == 2:
        p = p * 2
    elif len(p) == 3:
        p = p + [p[1]]
    return p[:4]


# ───────────────────────── селектори для .no-fgap ─────────────────────────
def _parts(sel):
    return [re.sub(r'\s+', ' ', s.strip()) for s in sel.split(',') if s.strip()]


def _no_fgap(part):
    if '::' in part:
        return None
    if part.startswith(':root'):
        return ':root.no-fgap' + part[5:]
    if re.match(r'html\b', part):
        return 'html.no-fgap' + part[4:]
    return '.no-fgap ' + part


# ───────────────────────── обробка одного <style> ─────────────────────────
def process_css(css, h):
    rules = []
    for prelude, b0, b1, ctx in blocks(css):
        ds = decls(css[b0:b1])
        if ds is not None:
            rules.append((prelude, b1, ds))

    # змінні :root для обчислення oklch (тон --h — з data-subject сторінки)
    root = {}
    for sel, _, ds in rules:
        if sel == ':root':
            for n, v, _ in ds:
                if n.startswith('--'):
                    root[n] = v
    if h is not None:
        root['--h'] = str(h)

    # хто флекс і в який бік
    flex, column, wrap = set(), set(), set()
    for sel, _, ds in rules:
        d = {n: v for n, v, _ in ds}
        is_flex = d.get('display', '') in ('flex', 'inline-flex') or 'flex-direction' in d or 'flex-flow' in d
        for p in _parts(sel):
            if is_flex:
                flex.add(p)
            dirv = d.get('flex-direction', '') + ' ' + d.get('flex-flow', '')
            if 'column' in dirv:
                column.add(p)
            if 'wrap' in d.get('flex-wrap', '') + ' ' + d.get('flex-flow', ''):
                wrap.add(p)

    ins = []
    for sel, end, ds in rules:
        d = {n: v for n, v, _ in ds}
        vars_ = dict(root)
        for n, v, _ in ds:
            if n.startswith('--'):
                vars_[n] = v
        if '--h' in d:
            vars_['--h'] = d['--h']
        groups = {}

        def put(feats, text):
            key = ' and '.join(TEST[f] for f in sorted(feats))
            groups.setdefault(key, []).append(text)

        for n, v, imp in ds:
            bang = ' !important' if imp else ''
            low = lower(v, vars_)
            val, feats = (low if low else (v, set()))
            if n == 'inset':
                feats = feats | {'inset'}
                t, r, b, l = _sides(val)
                put(feats, 'top:%s%s;right:%s%s;bottom:%s%s;left:%s%s' % (t, bang, r, bang, b, bang, l, bang))
            elif n in LOGICAL:
                v2 = val.split()
                a_, b_ = LOGICAL[n]
                put(feats | {'logical'}, '%s:%s%s;%s:%s%s' % (a_, v2[0], bang, b_, v2[-1], bang))
            elif low:
                put(feats, '%s:%s%s' % (n, val, bang))

        # gap
        gaps = [(n, v) for n, v, _ in ds if n in ('gap', 'row-gap', 'column-gap')]
        if gaps:
            parts = _parts(sel)
            grid = d.get('display', '') in ('grid', 'inline-grid') or any(k.startswith('grid-template') for k in d)
            if grid:
                for n, v in gaps:
                    low = lower(v, vars_)
                    put(({'gap'} | (low[1] if low else set())), 'grid-%s:%s' % (n, low[0] if low else v))
            elif any(p in flex for p in parts):
                row = col = None
                for n, v in gaps:
                    low = lower(v, vars_)
                    vv = (low[0] if low else v).split()
                    if n == 'gap':
                        row, col = vv[0], vv[-1]
                    elif n == 'row-gap':
                        row = vv[0]
                    else:
                        col = vv[0]
                for p in parts:
                    q = _no_fgap(p)
                    if not q:
                        continue
                    if p in column:
                        m, last = ('margin-bottom:%s' % row) if row else '', 'margin-bottom:0'
                    elif p in wrap:
                        m = ';'.join(x for x in (col and 'margin-right:%s' % col, row and 'margin-bottom:%s' % row) if x)
                        last = None
                    else:
                        m, last = ('margin-right:%s' % col) if col else '', 'margin-right:0'
                    if not m:
                        continue
                    txt = '%s>*{%s}' % (q, m)
                    if last:
                        txt += '%s>*:last-child{%s}' % (q, last)
                    ins.append((end + 1, MARK_OPEN + txt + MARK_CLOSE))

        for cond, items in groups.items():
            ins.append((end + 1, '%s@supports not (%s){%s{%s}}%s' % (MARK_OPEN, cond, sel, ';'.join(items), MARK_CLOSE)))

    for pos, text in sorted(ins, key=lambda x: x[0], reverse=True):
        css = css[:pos] + text + css[pos:]
    return css, len(ins)


STYLE_RE = re.compile(r'(<style\b[^>]*>)(.*?)(</style>)', re.S | re.I)


def strip(html):
    """Прибрати все, що дописав цей інструмент."""
    return SCRIPT_RE.sub('', GEN_RE.sub('', html))


def process_html(html):
    html = strip(html)
    m = re.search(r'<html\b[^>]*\bdata-subject="([^"]+)"', html)
    h = SUBJECT_H.get(m.group(1)) if m else None
    total = [0]

    def sub(mm):
        css, n = process_css(mm.group(2), h)
        total[0] += n
        return mm.group(1) + css + mm.group(3)
    html = STYLE_RE.sub(sub, html)
    html = html.replace('</head>', FGAP_SCRIPT + '\n</head>', 1)
    return html, total[0]


def main(paths):
    for p in paths:
        src = open(p, encoding='utf-8').read()
        out, n = process_html(src)
        if out != src:
            open(p, 'w', encoding='utf-8').write(out)
        print('%4d  %s' % (n, p))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
