"""Writes the screenshot pages, using the real stylesheet and the real markup.

Both are read from src/ rather than duplicated, so a redesign of the wall shows
up in the store screenshots the next time these are built.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

css = (ROOT / "src" / "lock.css").read_text()
lock = (ROOT / "src" / "lock.js").read_text()
start = lock.index("root.innerHTML = `") + len("root.innerHTML = `")
markup = lock[start:lock.index("`;", start)]


def page(setup, bare):
    return f"""<!doctype html><meta charset="utf-8"><title>Latch</title>
<style>html,body{{margin:0;height:100%;background:oklch(10% 0.015 262);overflow:hidden}}
{css}
/* A screenshot is a still, so the staggered entrance has to be already over. */
#latch-wall .latch-inner > *, #latch-wall .latch-gauge {{
  opacity:1 !important; transform:none !important; transition:none !important; }}
</style>
<div id="latch-wall" class="is-in{' is-bare' if bare else ''}">{markup}</div>
<script>
const w = document.getElementById('latch-wall');
{setup}
</script>"""


LECTURE = """
w.querySelector('.latch-meta').textContent = 'Lecture lock · 24:18 of video left';
w.querySelector('.latch-title').textContent = 'Lecture 11: Eigenvectors and Eigenvalues';
w.querySelector('.latch-head').textContent = 'You are 38 minutes in.';
w.querySelector('.latch-body').textContent = 'The expensive part is already paid. Starting is what costs you, and you did that 38 minutes ago. Leaving now means paying it again later for the same material.';
w.querySelector('.latch-hint').textContent = 'Keep holding for 8.0s.';
const C = 2 * Math.PI * 112, done = 0.62;
const arc = w.querySelector('.latch-arc');
arc.style.strokeDasharray = C;
arc.style.strokeDashoffset = C * (1 - done);
w.querySelector('.latch-pct').innerHTML = '62<i>%</i>';
"""

READING = """
w.querySelector('.latch-meta').textContent = 'Reading lock';
w.querySelector('.latch-title').textContent = 'Week 6 Python Notes: Lists, Tuples and Sequences';
w.querySelector('.latch-head').textContent = 'You already decided this.';
w.querySelector('.latch-body').textContent = 'A calmer version of you turned this lock on, on purpose, before the boring part. He knew this moment was coming. Let him win one.';
w.querySelector('.latch-back').textContent = 'Back to the reading';
w.querySelector('.latch-hint').textContent = 'Keep holding for 8.0s.';
w.querySelector('.latch-gauge').remove();
"""

(OUT / "1-lecture.html").write_text(page(LECTURE, bare=False))
(OUT / "2-reading.html").write_text(page(READING, bare=True))
print(f"wrote {OUT}/1-lecture.html and {OUT}/2-reading.html")
