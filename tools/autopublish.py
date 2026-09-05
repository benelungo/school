#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Автопублікація сайту.

Стежить за проєктом і, щойно ви зберегли файл, сам:
  1. перебудовує index.html   (tools/build_index.py)
  2. робить коміт
  3. пушить на GitHub

Далі GitHub Pages оновлює сайт сам — приблизно за хвилину.

Комітяться ТІЛЬКИ ті файли, які дозволені в .gitignore
(презентації для класу + сам сайт). Учительські хронокарти, підручники,
КТП і оцінки не потрапляють у коміт навіть випадково.

    python3 tools/autopublish.py            # стежити, поки відкритий термінал
    python3 tools/autopublish.py --once     # опублікувати один раз і вийти
    python3 tools/autopublish.py --install  # запускати автоматично при вході
    python3 tools/autopublish.py --status   # чи працює
    python3 tools/autopublish.py --uninstall
"""

import argparse
import os
import plistlib
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

sys.path.insert(0, str(ROOT / "tools"))
import build_index  # noqa: E402

LABEL = "com.school.autopublish"
PLIST = Path.home() / "Library" / "LaunchAgents" / (LABEL + ".plist")
LOG = Path.home() / "Library" / "Logs" / "school-autopublish.log"

GIT = shutil.which("git") or "/usr/bin/git"

# скільки чекати між перевірками (сек)
DEFAULT_INTERVAL = 5
# з якої паузи починати після невдалого пушу і докуди рости
BACKOFF_START = 60
BACKOFF_MAX = 900


# ───────────────────────── дрібниці ─────────────────────────

def say(*parts):
    stamp = time.strftime("%H:%M:%S")
    print(stamp, *parts, flush=True)


def git(*args, **kw):
    check = kw.pop("check", False)
    r = subprocess.run(
        [GIT] + list(args),
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if check and r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).strip())
    return r


def is_repo():
    return git("rev-parse", "--is-inside-work-tree").returncode == 0


def branch():
    return git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip() or "main"


def has_remote():
    return "origin" in git("remote").stdout.split()


def busy():
    """Не лізти, поки триває злиття / rebase / інша операція."""
    g = ROOT / ".git"
    for name in ("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD",
                 "rebase-merge", "rebase-apply", "index.lock"):
        if (g / name).exists():
            return True
    return False


def changes():
    """Список (код, шлях). -z, бо в іменах є пробіли й кирилиця."""
    out = git("status", "--porcelain", "-z").stdout
    fields = out.split("\0")
    items = []
    i = 0
    while i < len(fields):
        rec = fields[i]
        i += 1
        if len(rec) < 4:
            continue
        code, path = rec[:2], rec[3:]
        if code[0] in ("R", "C"):   # перейменування: далі йде стара назва
            i += 1
        items.append((code.strip(), path))
    return items


# ───────────────────────── текст коміту ─────────────────────────

def lesson_of(path):
    """'9-А/Інформатика/Уроки/Урок 1/…' → '9-А · Інформатика · Урок 1'"""
    parts = Path(path).parts
    if len(parts) >= 4 and parts[2] == "Уроки":
        return "%s · %s · %s" % (parts[0], parts[1], parts[3])
    return None


def describe(items):
    lessons, site = [], []
    for code, path in items:
        name = lesson_of(path)
        if name:
            if name not in lessons:
                lessons.append(name)
        else:
            site.append(path)

    def plural(n, one, few, many):
        a, b = abs(n) % 100, abs(n) % 10
        if 10 < a < 20:
            return many
        if 1 < b < 5:
            return few
        return one if b == 1 else many

    if len(lessons) == 1 and not site:
        head = lessons[0]
    elif lessons and not site:
        head = "%d %s" % (len(lessons), plural(len(lessons), "урок", "уроки", "уроків"))
    elif lessons and site:
        head = "%d %s і сайт" % (len(lessons), plural(len(lessons), "урок", "уроки", "уроків"))
    elif len(site) == 1 and site[0] == "index.html":
        head = "список уроків"
    else:
        head = "сайт"

    msg = "Оновлено: " + head
    if len(lessons) > 1:
        msg += "\n\n" + "\n".join("- " + n for n in lessons)
    return msg


# ───────────────────────── публікація ─────────────────────────

def rebuild_index():
    """
    Перебудовує index.html. Викликається ЩОЦИКЛА, а не лише коли git бачить
    зміни: учительські файли ігноруються git'ом, тож поява очного уроку
    інакше лишилася б непоміченою. index.html перезаписується лише тоді,
    коли список справді змінився.
    """
    try:
        return build_index.write_index(build_index.collect())
    except SystemExit as e:
        say("!  build_index:", e)
    except Exception as e:
        say("!  build_index:", e)
    return False


def commit():
    """Повертає True, якщо коміт справді зроблено."""
    items = changes()
    if not items:
        return False

    for code, path in items:
        say("   %-2s %s" % (code, path))

    git("add", "-A")
    if not changes():           # усе, що змінилось, — ігнороване
        return False

    msg = describe(items)
    r = git("commit", "-m", msg)
    if r.returncode != 0:
        say("!  коміт не вдався:", (r.stderr or r.stdout).strip())
        return False
    say("→  коміт:", msg.splitlines()[0])
    return True


def unpushed():
    """Чи є локальні коміти, яких немає на GitHub."""
    if not has_remote():
        return False
    b = branch()
    if git("rev-parse", "--verify", "origin/" + b).returncode != 0:
        return git("rev-parse", "--verify", "HEAD").returncode == 0
    n = git("rev-list", "--count", "origin/%s..HEAD" % b).stdout.strip()
    return n.isdigit() and int(n) > 0


def push():
    b = branch()
    git("fetch", "origin")

    # якщо GitHub Action уже дописав свій коміт — стаємо поверх нього
    if git("rev-parse", "--verify", "origin/" + b).returncode == 0:
        r = git("rebase", "origin/" + b)
        if r.returncode != 0:
            git("rebase", "--abort")
            say("!  конфлікт із GitHub — розберіться вручну:",
                "git pull --rebase")
            return False

    r = git("push", "-u", "origin", b)
    if r.returncode != 0:
        say("!  пуш не вдався:", (r.stderr or r.stdout).strip().splitlines()[-1])
        return False
    say("→  запушено на GitHub")
    return True


# ───────────────────────── режими ─────────────────────────

def preflight():
    if not is_repo():
        print("Це ще не git-репозиторій. Спершу:\n"
              "    git init && git add -A && git commit -m 'Уроки'\n"
              "    git branch -M main")
        return False
    return True


def once():
    if not preflight():
        return 1
    if rebuild_index():
        say("→  список уроків оновлено")
    did = commit()
    if not has_remote():
        say("Нема remote 'origin' — коміт зроблено локально.")
        say("Додайте репозиторій:  git remote add origin <URL>")
        return 0
    if did or unpushed():
        push()
    else:
        say("Нічого нового.")
    return 0


def watch(interval):
    if not preflight():
        return 1

    say("Стежу за змінами. Ctrl+C — зупинити.")
    if not has_remote():
        say("Увага: remote 'origin' не налаштований — поки що тільки локальні коміти.")

    prev = None
    need_push = unpushed()
    backoff = BACKOFF_START
    retry_at = 0.0

    while True:
        try:
            if not busy():
                if rebuild_index():
                    say("→  список уроків оновлено")
                now = changes()
                if now and now == prev:      # два однакові заміри поспіль — файл дозбережено
                    if commit():
                        need_push = True
                        backoff, retry_at = BACKOFF_START, 0.0
                    prev = None
                else:
                    prev = now

            if need_push and has_remote() and time.time() >= retry_at:
                if push():
                    need_push = False
                    backoff, retry_at = BACKOFF_START, 0.0
                else:
                    retry_at = time.time() + backoff
                    say("   спробую ще раз через %d с" % backoff)
                    backoff = min(backoff * 2, BACKOFF_MAX)

            time.sleep(interval)

        except KeyboardInterrupt:
            say("Зупинено.")
            return 0
        except Exception as e:                      # ніколи не падаємо назовсім
            say("!  несподівана помилка:", e)
            time.sleep(interval * 4)


# ───────────────────────── автозапуск (launchd) ─────────────────────────

def python_for_agent():
    """Системний python стабільніший за .venv, який можна перестворити."""
    if os.access("/usr/bin/python3", os.X_OK):
        return "/usr/bin/python3"
    return sys.executable


def install(interval):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    PLIST.parent.mkdir(parents=True, exist_ok=True)

    plist = {
        "Label": LABEL,
        "ProgramArguments": [
            python_for_agent(), str(Path(__file__).resolve()),
            "--watch", "--interval", str(interval),
        ],
        "WorkingDirectory": str(ROOT),
        "EnvironmentVariables": {
            "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
        },
        "RunAtLoad": True,
        "KeepAlive": True,
        "ThrottleInterval": 30,
        "StandardOutPath": str(LOG),
        "StandardErrorPath": str(LOG),
    }
    with open(PLIST, "wb") as f:
        plistlib.dump(plist, f)

    uid = os.getuid()
    subprocess.run(["launchctl", "bootout", "gui/%d/%s" % (uid, LABEL)],
                   capture_output=True)
    r = subprocess.run(["launchctl", "bootstrap", "gui/%d" % uid, str(PLIST)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        r = subprocess.run(["launchctl", "load", "-w", str(PLIST)],
                           capture_output=True, text=True)
    if r.returncode != 0:
        print("Не вдалося запустити:", (r.stderr or r.stdout).strip())
        return 1

    print("Готово. Автопублікація працює і вмикатиметься при вході в систему.")
    print("Журнал:", LOG)
    return 0


def uninstall():
    uid = os.getuid()
    subprocess.run(["launchctl", "bootout", "gui/%d/%s" % (uid, LABEL)],
                   capture_output=True)
    subprocess.run(["launchctl", "unload", "-w", str(PLIST)], capture_output=True)
    if PLIST.exists():
        PLIST.unlink()
    print("Автопублікацію вимкнено.")
    return 0


def status():
    r = subprocess.run(["launchctl", "list", LABEL], capture_output=True, text=True)
    if r.returncode == 0:
        print("Автопублікація: працює")
        for line in r.stdout.splitlines():
            if '"PID"' in line or '"LastExitStatus"' in line:
                print("   " + line.strip().rstrip(";"))
    else:
        print("Автопублікація: вимкнена  (увімкнути: --install)")
    print("Журнал:", LOG, "—", "є" if LOG.exists() else "ще порожній")
    if is_repo():
        print("Гілка:", branch(), "· remote:",
              "є" if has_remote() else "НЕМАЄ — пушити нікуди")
        n = len(changes())
        print("Незакомічених змін:", n)
    return 0


def main():
    ap = argparse.ArgumentParser(add_help=True, description="Автопублікація сайту")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--once", action="store_true", help="опублікувати один раз і вийти")
    g.add_argument("--watch", action="store_true", help="стежити безперервно (типово)")
    g.add_argument("--install", action="store_true", help="запускати при вході в систему")
    g.add_argument("--uninstall", action="store_true", help="вимкнути автозапуск")
    g.add_argument("--status", action="store_true", help="показати стан")
    ap.add_argument("--interval", type=int, default=DEFAULT_INTERVAL,
                    help="пауза між перевірками, сек (типово %d)" % DEFAULT_INTERVAL)
    a = ap.parse_args()

    if a.install:
        return install(a.interval)
    if a.uninstall:
        return uninstall()
    if a.status:
        return status()
    if a.once:
        return once()
    return watch(a.interval)


if __name__ == "__main__":
    sys.exit(main())
