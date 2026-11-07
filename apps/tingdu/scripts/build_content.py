#!/usr/bin/env python3
"""Turn content/stories/*.txt into the reader's data files.

For every story this writes:
  public/audio/<id>.mp3      narration (Microsoft Edge neural voice, via edge-tts)
  public/stories/<id>.json   text split into words, with pinyin, Traditional
                             characters, English, and each word's start/end time
and a public/stories/index.json listing them all.

Narration is cached in content/tts/<id>.json (the word timings) next to the mp3,
keyed by a hash of the spoken text, voice and rate, so re-running only calls the
TTS service for stories whose text changed. Pinyin and Traditional characters are
always regenerated, so fixing a `fix:` line needs no network.

    pip install -r scripts/requirements.txt
    python3 scripts/build_content.py            # build everything that changed
    python3 scripts/build_content.py --check    # print pinyin for review, write nothing
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import ssl
import sys
import unicodedata
from pathlib import Path

from opencc import OpenCC
from pypinyin import Style, lazy_pinyin

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "content" / "stories"
TTS_CACHE = ROOT / "content" / "tts"
OUT_STORIES = ROOT / "public" / "stories"
OUT_AUDIO = ROOT / "public" / "audio"

# Edge returns 24 kHz mono MP3 at a constant 48 kbit/s.
MP3_BYTES_PER_MS = 48_000 / 8 / 1000

# Readings pypinyin gets wrong in these stories, applied to every story.
# Story files can add their own with `fix: 词=pin yin` lines.
#
# 一 and 不 change tone with the next syllable (see tone_change_yi_bu); those are
# handled by rule, so they need no entries here. The third-tone change (你好 ní hǎo)
# is NOT marked, following the convention of Chinese school books.
GLOBAL_FIXES = {
    # polyphones
    "长得": "zhǎng de",
    "长出": "zhǎng chū",
    "长大": "zhǎng dà",
    "又干": "yòu gān",
    "觉晓": "jué xiǎo",
    "谁": "shéi",
    "舍不得": "shě bu de",
    "看不见": "kàn bu jiàn",
    "噼里啪啦": "pī li pā lā",
    "哗啦啦": "huā lā lā",
    "哦": "o",
    "都": "dōu",
    "一圈一圈": "yì quān yì quān",
    "点儿": "diǎn r",
    "花儿": "huā r",
    # 地 as the adverb marker (-ly) is "de"
    "慢慢地": "màn màn de",
    "悄悄地": "qiāo qiāo de",
    "小声地": "xiǎo shēng de",
    "吃惊地": "chī jīng de",
    "地响": "de xiǎng",
    # neutral tones
    "爸爸": "bà ba",
    "妈妈": "mā ma",
    "奶奶": "nǎi nai",
    "妹妹": "mèi mei",
    "爷爷": "yé ye",
    "娘娘": "niáng niang",
    "谢谢": "xiè xie",
    "看看": "kàn kan",
    "星星": "xīng xing",
    "朋友": "péng you",
    "喜欢": "xǐ huan",
    "东西": "dōng xi",
    "名字": "míng zi",
    "时候": "shí hou",
    "告诉": "gào su",
    "故事": "gù shi",
    "衣服": "yī fu",
    "头发": "tóu fa",
    "关系": "guān xi",
    "地方": "dì fang",
    "力气": "lì qi",
    "庄稼": "zhuāng jia",
    "狐狸": "hú li",
    "热闹": "rè nao",
    "凉快": "liáng kuai",
    "月亮": "yuè liang",
    "妻子": "qī zi",
    "葡萄": "pú tao",
    "点心": "diǎn xin",
    "早上": "zǎo shang",
    "晚上": "wǎn shang",
    "多少钱": "duō shao qián",
    "愿意": "yuàn yi",
    "什么": "shén me",
    "怎么": "zěn me",
    "那么": "nà me",
    "这么": "zhè me",
}

END_PUNCT = "。！？；…"
s2t = OpenCC("s2tw")


def is_hanzi(ch: str) -> bool:
    return "CJK UNIFIED IDEOGRAPH" in unicodedata.name(ch, "")


def is_spoken(ch: str) -> bool:
    """Characters the narrator says (as opposed to punctuation and spaces)."""
    return is_hanzi(ch) or ch.isalnum()


# ---------------------------------------------------------------- parsing

def parse_story(path: Path) -> dict:
    head, _, body = path.read_text(encoding="utf-8").partition("\n---\n")
    meta: dict = {"fix": {}}
    for line in head.splitlines():
        if not line.strip():
            continue
        key, _, value = line.partition(":")
        key, value = key.strip(), value.strip()
        if key == "fix":
            word, _, py = value.partition("=")
            meta["fix"][word.strip()] = py.strip()
        else:
            meta[key] = value

    paragraphs = []
    for block in re.split(r"\n\s*\n", body.strip()):
        lines = [l.strip() for l in block.splitlines() if l.strip()]
        if len(lines) % 2:
            sys.exit(f"{path.name}: paragraph has an odd number of lines (each Chinese line needs an English line):\n{block}")
        paragraphs.append([(lines[i], lines[i + 1]) for i in range(0, len(lines), 2)])

    sentences = [{"role": "title", "para": -1, "zh": meta["title"], "en": meta["en"]}]
    if meta.get("author"):
        sentences.append({"role": "author", "para": -1, "zh": meta["author"], "en": meta.get("author_en", "")})
    for p, para in enumerate(paragraphs):
        for zh, en in para:
            sentences.append({"role": "body", "para": p, "zh": zh, "en": en})

    return {
        "id": path.stem,
        "meta": meta,
        "sentences": sentences,
    }


def spoken_text(story: dict) -> str:
    """What the narrator reads: every sentence, with a full stop after lines that lack one
    (the title, the author) so the voice pauses there."""
    parts = []
    for s in story["sentences"]:
        zh = s["zh"]
        if zh[-1] not in END_PUNCT + "，：”":
            zh += "。"
        parts.append(zh)
    return "\n".join(parts)


# ---------------------------------------------------------------- pinyin and Traditional

def sentence_pinyin(zh: str, fixes: dict[str, str]) -> list[str | None]:
    """One reading per character (None for punctuation)."""
    readings: list[str | None] = list(lazy_pinyin(zh, style=Style.TONE, errors=lambda run: [None] * len(run)))
    assert len(readings) == len(zh), (zh, readings)
    for i, ch in enumerate(zh):
        if not is_hanzi(ch):
            readings[i] = None
    fixed = [False] * len(zh)
    # longer words first, so 舍不得 wins over a shorter overlapping entry
    for word, py in sorted(fixes.items(), key=lambda kv: -len(kv[0])):
        syllables = py.split()
        assert len(syllables) == len(word), f"fix {word}={py}: need one syllable per character"
        for m in re.finditer(re.escape(word), zh):
            for k, syl in enumerate(syllables):
                if not fixed[m.start() + k]:
                    readings[m.start() + k] = syl
                    fixed[m.start() + k] = True
    for i, ch in enumerate(zh):
        if fixed[i]:
            continue
        if ch == "得":
            # the complement marker (跑得快) is neutral; 得到 "obtain" is dé
            readings[i] = "dé" if zh[i + 1:i + 2] == "到" else "de"
        elif ch in "一不":
            readings[i] = tone_change_yi_bu(zh, readings, i)
    return readings


TONE_MARKS = {"āēīōūǖ": 1, "áéíóúǘ": 2, "ǎěǐǒǔǚ": 3, "àèìòùǜ": 4}
NUMERALS = "零一二三四五六七八九十百千万两第"


def tone_of(syllable: str | None) -> int:
    """1-4, 5 for the neutral tone, 0 when there is no syllable."""
    if not syllable:
        return 0
    for marks, tone in TONE_MARKS.items():
        if any(m in syllable for m in marks):
            return tone
    return 5


def tone_change_yi_bu(zh: str, readings: list[str | None], i: int) -> str:
    """一 and 不 are marked with the tone they are actually spoken with, as in children's books:
    一个 yí gè, 一天 yì tiān, 第一 dì yī, 想一想 xiǎng yi xiǎng; 不是 bú shì, 不好 bù hǎo, 怕不怕 pà bu pà."""
    ch = zh[i]
    prev, nxt = zh[i - 1:i] if i else "", zh[i + 1:i + 2]
    nxt_tone = tone_of(readings[i + 1]) if nxt else 0
    if ch == "一":
        if prev and prev == nxt and is_hanzi(prev):
            return "yi"
        if (prev and prev in NUMERALS) or (nxt and nxt in NUMERALS) or not nxt_tone:
            return "yī"
        if nxt_tone == 4 or nxt == "个":
            return "yí"
        return "yì"
    if prev and prev == nxt and is_hanzi(prev):
        return "bu"
    return "bú" if nxt_tone == 4 else "bù"


def traditional(zh: str) -> str:
    t = s2t.convert(zh)
    if len(t) != len(zh):
        t = "".join(s2t.convert(ch) if len(s2t.convert(ch)) == 1 else ch for ch in zh)
    out = []
    for i, c in enumerate(t):
        if c == "里" and zh[i - 1:i] not in ("公", "千", "万", "故", "邻"):
            c = "裡"  # OpenCC misses 里 "inside" after some words; in these stories it always means inside
        elif zh[i] == "游":
            c = "游"  # swimming is 游 in Traditional too (OpenCC makes some of them 遊 "travel")
        out.append(c)
    return "".join(out)


# ---------------------------------------------------------------- narration

async def synthesize(text: str, voice: str, rate: str, mp3_path: Path) -> list[dict]:
    import edge_tts
    import edge_tts.communicate as communicate

    # Respect the environment's CA bundle and proxy (edge-tts pins certifi by default).
    cafile = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
    if cafile:
        communicate._SSL_CTX = ssl.create_default_context(cafile=cafile)
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")

    comm = edge_tts.Communicate(text, voice, rate=rate, proxy=proxy, boundary="WordBoundary")
    words = []
    audio = bytearray()
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            # offsets are in 100 ns ticks
            words.append({
                "text": chunk["text"],
                "start": round(chunk["offset"] / 10_000),
                "end": round((chunk["offset"] + chunk["duration"]) / 10_000),
            })
    if not audio:
        raise RuntimeError("TTS returned no audio")
    mp3_path.write_bytes(bytes(audio))
    return words


def narrate(story: dict, offline: bool) -> dict:
    meta = story["meta"]
    voice = meta.get("voice", "zh-CN-XiaoxiaoNeural")
    rate = meta.get("rate", "-10%")
    text = spoken_text(story)
    key = hashlib.sha256(f"{voice}|{rate}|{text}".encode()).hexdigest()[:16]
    cache_path = TTS_CACHE / f"{story['id']}.json"
    mp3_path = OUT_AUDIO / f"{story['id']}.mp3"

    if cache_path.exists() and mp3_path.exists():
        cached = json.loads(cache_path.read_text())
        if cached["key"] == key:
            return cached
    if offline:
        sys.exit(f"{story['id']}: narration is out of date and --offline was given")

    print(f"  narrating {story['id']} ({voice}, {rate}) ...", flush=True)
    words = asyncio.run(synthesize(text, voice, rate, mp3_path))
    cached = {"key": key, "voice": voice, "rate": rate, "words": words}
    cache_path.write_text(json.dumps(cached, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    return cached


# ---------------------------------------------------------------- alignment

def align(story: dict, words: list[dict]) -> list[list[tuple[int, int] | None]]:
    """For each sentence, for each character: the (word index) the narrator said it in, or None.

    The TTS reports words in order; we walk the story's spoken characters in step with them.
    """
    slots = [(si, ci, ch) for si, s in enumerate(story["sentences"]) for ci, ch in enumerate(s["zh"]) if is_spoken(ch)]
    owner = [[None] * len(s["zh"]) for s in story["sentences"]]
    pos = 0
    for wi, w in enumerate(words):
        chars = [c for c in w["text"] if is_spoken(c)]
        if not chars:
            continue
        # find this word at or shortly after the current position
        found = -1
        for j in range(pos, min(pos + 12, len(slots) - len(chars) + 1)):
            if all(slots[j + k][2] == chars[k] for k in range(len(chars))):
                found = j
                break
        if found < 0:
            print(f"  warning: {story['id']}: could not place narrated word {w['text']!r} near "
                  f"{''.join(c for _, _, c in slots[pos:pos + 12])!r}", file=sys.stderr)
            continue
        for k in range(len(chars)):
            si, ci, _ = slots[found + k]
            owner[si][ci] = wi
        pos = found + len(chars)
    return owner


def build_tokens(story: dict, words: list[dict], owner) -> None:
    """Group each sentence's characters into tokens (one per narrated word, one per
    punctuation mark) with start/end times in ms."""
    fixes = {**GLOBAL_FIXES, **story["meta"]["fix"]}
    for si, s in enumerate(story["sentences"]):
        zh = s["zh"]
        trad = traditional(zh)
        py = sentence_pinyin(zh, fixes)
        tokens = []
        i = 0
        while i < len(zh):
            w = owner[si][i]
            j = i + 1
            if w is not None:
                while j < len(zh) and owner[si][j] == w:
                    j += 1
            tok = {"t": zh[i:j]}
            if trad[i:j] != zh[i:j]:
                tok["tt"] = trad[i:j]
            if is_spoken(zh[i]):
                tok["py"] = py[i:j]
                if w is not None:
                    tok["s"], tok["e"] = words[w]["start"], words[w]["end"]
            tokens.append(tok)
            i = j

        # Spoken characters the TTS did not report get times interpolated from their neighbours.
        for k, tok in enumerate(tokens):
            if "py" in tok and "s" not in tok:
                prev = next((t["e"] for t in reversed(tokens[:k]) if "e" in t), None)
                nxt = next((t["s"] for t in tokens[k + 1:] if "s" in t), None)
                if prev is None and nxt is None:
                    continue
                prev = prev if prev is not None else nxt - 300
                nxt = nxt if nxt is not None else prev + 300
                tok["s"], tok["e"] = prev, max(prev, nxt)

        timed = [t for t in tokens if "s" in t]
        s["tokens"] = tokens
        s["start"] = timed[0]["s"] if timed else None
        s["end"] = timed[-1]["e"] if timed else None
        s["tt"] = trad


def build_story(path: Path, offline: bool) -> dict:
    story = parse_story(path)
    narration = narrate(story, offline)
    owner = align(story, narration["words"])
    build_tokens(story, narration["words"], owner)

    meta = story["meta"]
    mp3 = OUT_AUDIO / f"{story['id']}.mp3"
    duration = round(mp3.stat().st_size / MP3_BYTES_PER_MS)
    out = {
        "id": story["id"],
        "title": meta["title"],
        "titleTrad": traditional(meta["title"]),
        "en": meta["en"],
        "level": int(meta.get("level", 1)),
        "kind": meta.get("kind", "story"),
        "audio": f"audio/{story['id']}.mp3",
        "duration": duration,
        "voice": narration["voice"],
        "sentences": [
            {k: s[k] for k in ("role", "para", "en", "start", "end", "tokens")} for s in story["sentences"]
        ],
    }
    for k_in, k_out in (("author_en", "authorEn"), ("dynasty", "dynasty"), ("note", "note")):
        if meta.get(k_in):
            out[k_out] = meta[k_in]
    return out


def summary(story: dict) -> dict:
    title_tokens = story["sentences"][0]["tokens"]
    chars = sum(len(t["t"]) for s in story["sentences"] if s["role"] == "body" for t in s["tokens"] if "py" in t)
    return {
        "id": story["id"],
        "title": story["title"],
        "titleTrad": story["titleTrad"],
        "titlePy": " ".join(p for t in title_tokens for p in t.get("py", [])),
        "en": story["en"],
        "level": story["level"],
        "kind": story["kind"],
        "duration": story["duration"],
        "chars": chars,
        "unique": len({c for s in story["sentences"] if s["role"] == "body" for t in s["tokens"] if "py" in t for c in t["t"]}),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="print each story with pinyin for proofreading; write nothing")
    ap.add_argument("--offline", action="store_true", help="fail instead of calling the TTS service")
    ap.add_argument("only", nargs="*", help="story ids to print with --check")
    args = ap.parse_args()

    for d in (TTS_CACHE, OUT_STORIES, OUT_AUDIO):
        d.mkdir(parents=True, exist_ok=True)

    paths = sorted(SRC.glob("*.txt"))
    if args.check:
        for path in paths:
            story = parse_story(path)
            if args.only and story["id"] not in args.only:
                continue
            print(f"\n== {story['id']}")
            fixes = {**GLOBAL_FIXES, **story["meta"]["fix"]}
            for s in story["sentences"]:
                py = sentence_pinyin(s["zh"], fixes)
                print(s["zh"], "|", traditional(s["zh"]))
                print("   ", " ".join(p for p in py if p))
        return

    index = []
    for path in paths:
        story = build_story(path, args.offline)
        (OUT_STORIES / f"{story['id']}.json").write_text(
            json.dumps(story, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        index.append(summary(story))
        print(f"{story['id']}: {len(story['sentences'])} lines, {story['duration'] / 1000:.0f}s")

    known = {p.stem for p in paths}
    for stale in [*OUT_STORIES.glob("*.json"), *OUT_AUDIO.glob("*.mp3"), *TTS_CACHE.glob("*.json")]:
        if stale.stem not in known and stale.name != "index.json":
            stale.unlink()
            print(f"removed stale {stale.relative_to(ROOT)}")

    (OUT_STORIES / "index.json").write_text(
        json.dumps({"stories": index}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
