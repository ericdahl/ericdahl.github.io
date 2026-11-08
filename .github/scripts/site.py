#!/usr/bin/env python3
"""Write the Pages index and the redirect stubs for moved paths.

Usage: site.py <site dir> <published dir>...

Each published dir is like "apps/macros" or "games/starforge/claude": the first
segment is the section, the second the app, and an optional third the variant
(the same game built more than once).
"""
import html
import re
import sys
from pathlib import Path

SECTIONS = {"apps": "Apps", "games": "Games"}

# Shown as cards at the top of the index, in this order: path -> (call to action,
# accent class in the page's CSS). Each needs an icon.svg.
FEATURED = {
    "games/hellforge": ("Play", "ember"),
    "apps/tingdu": ("Start reading", "ink"),
}

# Paths that moved since the site went up: old -> new. Each old path, and the
# same path under the original /scratch/ project-site prefix, forwards to the new.
MOVED = {
    "games/macros/claude": "apps/macros",
    "games/tingdu/claude": "apps/tingdu",
    "games/hellforge/claude": "games/hellforge",
    "games/hellforge/codex": "games/hellforge-codex",
}

# Still published at their URLs, but only linked from the small list at the bottom
# of the index, under the label given here.
ARCHIVED = {
    "games/hellforge-codex": "Hellforge (codex)",
    "games/starforge/codex": "Starforge (codex)",
}

STUB = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Moved</title><link rel="canonical" href="{to}">
<meta http-equiv="refresh" content="0; url={to}">
<script>location.replace('{to}' + location.search + location.hash)</script>
</head><body><p>Moved to <a href="{to}">{to}</a>.</p></body></html>
"""

PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scratch</title>
<meta name="description" content="Small apps and games, mostly built with AI.">
<style>
:root{{color-scheme:light dark;--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--link:#0369a1;--line:#e7e5e4}}
@media (prefers-color-scheme:dark){{:root{{--bg:#0c0f14;--fg:#e7e5e4;--muted:#8b949e;--link:#5cc8ff;--line:#1f2630}}}}
body{{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}}
main{{max-width:640px;margin:0 auto;padding:48px 16px}}
h1{{margin:0;font-size:28px}}
header p{{margin:4px 0 0;color:var(--muted)}}
h2{{margin:40px 0 4px;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}}
ul{{list-style:none;margin:0;padding:0}}
li{{padding:10px 0;border-bottom:1px solid var(--line)}}
a{{color:var(--link);text-decoration:none}}a:hover{{text-decoration:underline}}
.name{{font-size:16px;font-weight:600}}
.desc{{margin:2px 0 0;color:var(--muted);font-size:14px}}
.ember{{--accent:#b45309}}.ink{{--accent:#b91c1c}}
@media (prefers-color-scheme:dark){{.ember{{--accent:#f5a35c}}.ink{{--accent:#f4837a}}}}
.featured{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:32px}}
.card{{display:flex;flex-direction:column;padding:20px;border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);border-radius:12px;background:color-mix(in srgb,var(--accent) 7%,transparent);color:var(--fg)}}
.card:hover{{text-decoration:none;border-color:var(--accent)}}
.card img{{display:block;margin-bottom:12px;border-radius:10px}}
.card .name{{font-size:20px}}
.card .desc{{font-size:15px}}
.cta{{margin-top:auto;padding-top:12px;font-size:15px;font-weight:600;color:var(--accent)}}
.variants{{margin-left:8px;font-size:14px}}
.variants a+a::before{{content:"·";color:var(--muted);margin:0 6px}}
.archive p{{margin:6px 0 0;color:var(--muted);font-size:14px}}
.archive a{{color:inherit;text-decoration:underline}}
</style>
</head><body><main>
<header><h1>Scratch</h1><p>Small apps and games, mostly built with AI.</p></header>
{sections}
</main></body></html>
"""


def meta(page: Path) -> tuple[str, str]:
    text = page.read_text(encoding="utf-8")
    title = re.search(r"<title>(.*?)</title>", text, re.S)
    desc = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', text)
    # Both come from the apps' own HTML, so they are already HTML-escaped.
    return (title.group(1).strip() if title else ""), (desc.group(1) if desc else "")


def short(title: str) -> str:
    return re.split(r"\s+[—·|-]\s+", title)[0]


def main(site: Path, dirs: list[str]) -> None:
    groups: dict[str, dict[str, list[str]]] = {}
    for d in sorted(set(dirs) - set(ARCHIVED) - set(FEATURED)):
        section, app, *_ = d.split("/")
        groups.setdefault(section, {}).setdefault(app, []).append(d)

    out = []
    cards = []
    for d, (cta, accent) in FEATURED.items():
        if d in dirs:
            title, desc = meta(site / d / "index.html")
            cards.append(
                f'<a class="card {accent}" href="{d}/"><img src="{d}/icon.svg" alt="" width="44" height="44">'
                f'<span class="name">{short(title)}</span><p class="desc">{desc}</p>'
                f'<span class="cta">{cta} →</span></a>'
            )
    if cards:
        out.append(f'<section class="featured" aria-label="Featured">{"".join(cards)}</section>')

    for section in sorted(groups, key=lambda s: (list(SECTIONS).index(s) if s in SECTIONS else 99, s)):
        items = []
        for app, variants in sorted(groups[section].items()):
            infos = [(d, *meta(site / d / "index.html")) for d in variants]
            desc = next((ds for _, _, ds in infos if ds), "")
            if len(infos) == 1:
                d, title, _ = infos[0]
                head = f'<a class="name" href="{d}/">{title or html.escape(app)}</a>'
            else:
                name = short(infos[0][1]) or html.escape(app)
                links = "".join(f'<a href="{d}/">{html.escape(d.rsplit("/", 1)[1])}</a>' for d, _, _ in infos)
                head = f'<span class="name">{name}</span><span class="variants">{links}</span>'
            items.append(f"<li>{head}" + (f'<p class="desc">{desc}</p>' if desc else "") + "</li>")
        label = SECTIONS.get(section, html.escape(section.capitalize()))
        out.append(f"<section><h2>{label}</h2><ul>{''.join(items)}</ul></section>")

    archived =[f'<a href="{d}/">{label}</a>' for d, label in sorted(ARCHIVED.items()) if d in dirs]
    if archived:
        out.append(f'<section class="archive"><h2>Archive</h2><p>{" · ".join(archived)}</p></section>')

    (site / "index.html").write_text(PAGE.format(sections="\n".join(out)), encoding="utf-8")

    def stub(old: str, new: str) -> None:
        f = site / old / "index.html"
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(STUB.format(to=new), encoding="utf-8")

    stub("scratch", "/")
    for d in dirs:
        stub(f"scratch/{d}", f"/{d}/")
    for old, new in MOVED.items():
        stub(old, f"/{new}/")
        stub(f"scratch/{old}", f"/{new}/")


if __name__ == "__main__":
    main(Path(sys.argv[1]), sys.argv[2:])
