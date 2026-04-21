# 🔀 SubtitleMerge

Merge two subtitle files of different languages into a single dual-language subtitle file.  
Watch foreign films and TV series with both the original and translated subtitles side by side — learn a new language effortlessly.

**100% client-side** — your files never leave your browser.

![Preview](https://img.shields.io/badge/status-stable-2dd4bf?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

---

## ✨ Features

| Feature | Description |
|---|---|
| **Drag & Drop Upload** | Drop multiple `.srt` or `.vtt` files at once |
| **Auto-Pairing** | Detects language suffixes in filenames and pairs them automatically |
| **Timeline Preview** | Side-by-side preview of matched cues before merging |
| **Time Offset** | Per-file millisecond offset sliders to fix sync drift |
| **Smart Merge** | Matches cues by time overlap, not index — handles timing variations |
| **Italic Styling** | Optional italic wrapping for either language track |
| **Batch Merge** | Merge multiple pairs at once and download as ZIP |
| **Export Formats** | Output as `.srt` (SubRip) or `.vtt` (WebVTT) |

---

## 📦 Installation

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari)
- [Node.js](https://nodejs.org/) (only needed for the local dev server)

### Setup

```bash
# Clone or download the project
git clone <repo-url>
cd SubtitleMerge

# Start a local server (pick one)
npx -y serve .              # Option A: using serve
npx -y http-server .        # Option B: using http-server
python -m http.server 8000  # Option C: using Python
```

Then open **http://localhost:3000** (or whichever port is shown) in your browser.

> **Note:** A local server is required because the app uses ES modules (`import`/`export`), which browsers block when opening files directly via `file://`.

---

## 🚀 How to Use

### 1. Prepare Your Subtitle Files

Name your subtitle files with a **language suffix** so the app can auto-detect and pair them:

```
Movie.en.srt       ← English
Movie.de.srt       ← German
Movie.fr.srt       ← French
Show.S01E03.en.srt ← English
Show.S01E03.ja.srt ← Japanese
```

**Supported suffix patterns:**
- ISO codes: `.en`, `.de`, `.fr`, `.ja`, `.zh-CN`, `.pt-br`
- 3-letter codes: `.eng`, `.fre`, `.jpn`, `.kor`
- Full words: `_english`, `_german`, `_french`

### 2. Upload Files

Drag and drop your subtitle files onto the upload zone, or click to browse. You can upload multiple files at once — the app will auto-pair files that share the same base name.

### 3. Review Pairs

Each detected pair is shown as a card with:
- **Top** — the primary language (displayed first in the merged output)
- **Bottom** — the secondary language (displayed second)

You can:
- **⇅ Swap** the top/bottom order
- **👁 Preview** the matched cues side-by-side
- **Adjust offsets** — slide or type a millisecond offset to fix sync drift between the two tracks

### 4. Configure & Merge

Choose your options:
- **Output format** — `.srt` or `.vtt`
- **Italic** — optionally italicize either language track

Click **Merge & Download**. The merged file downloads automatically. For multiple pairs, use **Download All (ZIP)**.

---

## 📂 Project Structure

```
SubtitleMerge/
├── index.html          # Main HTML shell
├── css/
│   └── style.css       # Design system & component styles
├── js/
│   ├── app.js          # App orchestration, DOM wiring, state
│   ├── parser.js       # SRT & VTT parsing and serialization
│   ├── merger.js       # Cue-matching & merge engine
│   └── utils.js        # Language detection, file helpers
├── test/               # Sample subtitle files for testing
│   ├── Movie.en.srt
│   └── Movie.de.srt
└── README.md
```

---

## 🧠 How the Merge Works

1. **Parse** both subtitle files into cue arrays (`{ start, end, text }` in milliseconds)
2. **Match** each top cue to the bottom cue with the greatest time overlap
3. **Combine** matched pairs into a single cue with both texts separated by a newline
4. **Anchor timing** to the primary (top) language to avoid extending cue durations
5. **Clamp overlaps** — if any merged cue bleeds past the next one's start time, its end is trimmed
6. **Keep unmatched** cues as single-language entries so no content is lost

---

## 🛠 Tech Stack

- **HTML5** + **Vanilla CSS** + **Vanilla JavaScript** (ES modules)
- **No frameworks, no build step, no backend**
- [JSZip](https://stuk.github.io/jszip/) via CDN for batch ZIP downloads
- [Inter](https://fonts.google.com/specimen/Inter) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) via Google Fonts

---

## 📝 License

MIT — use it however you like.
