# 听读 Tīngdú: read along in Chinese

A read-along app for learning to read Chinese characters, for someone who already speaks Mandarin. Children's stories and Tang poems are narrated aloud. Each character lights up as it is spoken, with its pinyin above it. It runs in the browser on a phone, tablet or computer, and needs no install. "Add to Home Screen" gives it an app icon.

## Using it

- **Library**: ten stories in three levels, plus four classic Tang poems. A tick marks the ones already read, and "Continue" picks up where you left off.
- **Play**: the narration starts. The line being read is shaded, the word is tinted, and the character being spoken is highlighted. The text scrolls along with it. If you scroll by hand, it waits a few seconds before following again.
- **Tap a word**: you hear just that word, and a card shows it large with its pinyin (and the other script). "从这里读 Read from here" continues the story from that word. Tapping a word while the story is playing jumps there.
- **Mode button** (bottom left) cycles through:
  - 连续: read everything.
  - 逐句: stop after each line, which suits trying the next line yourself before hearing it.
  - 重复: loop one line.
- **Speed button** (bottom right): 0.6× to 1.2×. The pitch stays natural.
- **Aa** (top right) sets the display:
  - pinyin on or off (turn it off once the characters are familiar)
  - tone colours
  - Simplified 简体 or Traditional 繁體 characters
  - English translation under each line
  - text size, font (黑体 / 楷体 / 宋体), and follow-along scrolling
- **自己的文章 Your own text**: paste any Chinese, such as a message from family or an article. It gets pinyin and is read by the device's own Mandarin voice, one line at a time. Pasted texts are saved on the device. On iPhone, the Chinese voice may need adding in Settings → Accessibility → Spoken Content → Voices (the page explains this if there's no voice).

Keyboard: space plays and pauses, ←/→ go to the previous or next line, Esc goes back.

## How it works

**Narration is generated ahead of time, not by the browser.** Browser speech (the Web Speech API) sounds different on every device, often robotic. Most phones also don't report which word is being spoken, so the highlighting can't be precise. Instead, `scripts/build_content.py` sends each story to Microsoft's neural voices through [edge-tts](https://github.com/rany2/edge-tts) (Xiaoxiao, plus Yunxi for two fables). It saves the MP3 along with the time each word is spoken. The app spreads each word's time across its characters, so the highlight tracks the narration to within a few tens of milliseconds, offline and on every device. All 14 pieces together come to about 4 MB.

Pasted text can't be pre-recorded, so the "your own text" page uses the device voice. Its highlighting is estimated from speaking speed, and uses the browser's word positions where it reports them.

**The content is original or public domain.** There aren't openly licensed Chinese children's audiobooks with text that lines up word-for-word. Popular picture books and school-textbook stories are copyrighted. So the library is:

- Four everyday stories written for this app: 我的一家, 小熊的生日, 小雨点去旅行, 和奶奶去买菜.
- Two more original stories: 团团的新朋友, about a panda meeting a red panda (a 小熊猫, "little panda"), and 十二生肖, a retelling of the folk tale.
- Retellings of ancient fables and legends, whose plots are public domain: 守株待兔, 狐假虎威, 年的故事, 嫦娥奔月.
- Tang poems (public domain): 静夜思, 春晓, 咏鹅, 悯农.

The vocabulary is high-frequency, and later levels use longer sentences.

**Pinyin** comes from [pypinyin](https://github.com/mozillazg/python-pinyin), plus corrections:

- 一 and 不 are marked with the tone they're spoken with (一个 yí gè, 一天 yì tiān, 不是 bú shì, 想一想 xiǎng yi xiǎng), as in Chinese children's books.
- The third-tone change (你好 ní hǎo) is not marked, also following those books.
- Particles are fixed (跑得快 de, 慢慢地 de).
- Neutral tones are added (朋友 péng you, 爸爸 bà ba).
- Polyphones get the right reading in context (长大 zhǎng, 又干又热 gān, 觉晓 jué).

Every line has been proofread. **Traditional characters** come from OpenCC (Taiwan standard).

## Adding a story

Write `content/stories/<id>.txt`:

```
title: 小狗的新家
en: The Puppy's New Home
level: 1                      # 1-3; "kind: poem" for poems (add author:, author_en:, dynasty:)
voice: zh-CN-XiaoxiaoNeural   # or zh-CN-YunxiNeural, zh-CN-XiaoyiNeural, ...
rate: -10%                    # narration speed
fix: 长大=zhǎng dà            # optional: correct a reading (one syllable per character)
---
第一句话。
The first sentence.
第二句话。
The second sentence.

A blank line starts a new paragraph.
Each Chinese line is followed by its English line.
```

Then:

```sh
pip install -r scripts/requirements.txt
python3 scripts/build_content.py --check <id>   # print the pinyin to proofread it
python3 scripts/build_content.py                # narrate new or changed stories, rebuild the JSON
```

Narration is cached in `content/tts/` by a hash of the text, voice and rate. Re-running only calls the TTS service for stories whose text changed. Pinyin fixes rebuild offline (`--offline`). Behind a TLS-intercepting proxy, set `SSL_CERT_FILE` to its CA bundle.

## Development

```sh
npm install
npm run dev        # http://localhost:5173, also on your LAN for testing on a phone
npm test           # unit tests, plus checks on every story's pinyin and timings
npm run e2e        # browser tests (phone and desktop sizes)
npm run build      # static site in dist/; published to GitHub Pages by .github/workflows/pages.yml
```

`src/` layout:

- `timeline.ts`: per-character timings.
- `player.ts`: narration player, plus the device-voice player for pasted text.
- `render.ts`: characters with pinyin.
- `reader.ts`: reading screen.
- `library.ts`: story list.
- `custom.ts`: pasted text, with pinyin from pinyin-pro (loaded only on that page).

## Ideas for later

- **Cantonese**: edge-tts has Cantonese neural voices (`zh-HK-HiuMaanNeural`, `zh-HK-WanLungNeural`), and jyutping could come from [ToJyutping](https://github.com/CanCLID/ToJyutping) or pycantonese. A `lang: yue` story setting would cover both. The reader already shows Traditional characters.
- **Hokkien / Minnan** (福建话): no mainstream TTS voice exists. Recorded narration (e.g. a family member reading) could be aligned with a forced aligner.
- **A real recorded audiobook**: the pipeline only needs word timings, so a human recording could be aligned (e.g. with WhisperX) instead of using TTS.
