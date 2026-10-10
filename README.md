# Modul: Design, Customize, Scan

Modul is a browser-based QR code studio. Users can create QR codes for links, text, email, phone numbers and Wi-Fi networks, style them with live previews, check how reliably they will scan, and export them as PNG, JPG or SVG.

Everything runs in the browser. There is no account, no backend and no upload of your data.

The site opens with a scroll-driven 3D film, drawn procedurally on a canvas, that leads into the studio.

**Live demo:** https://qr-code-generator-theta-ashen.vercel.app

**Repository:** https://github.com/TSsanjayy/QR-Code-Generator

> Readability scores are guidance, not a guarantee. Scanning performance varies across devices, cameras and lighting.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Scroll Film](#scroll-film)
- [Setup](#setup)
- [Using the Studio](#using-the-studio)
- [QR Payload Formats](#qr-payload-formats)
- [Scan Readability Score](#scan-readability-score)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Privacy](#privacy)
- [Design Decisions and Assumptions](#design-decisions-and-assumptions)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [Author](#author)

---

## How It Works

1. **Choose.** Pick a content type (Link, Text, Email, Phone or Wi-Fi) and enter the details. Input is validated as you type.
2. **Style.** Choose a preset or tune dots, corners, colors, gradient, size, margin, error correction and an optional logo. Hovering an option previews it on the real code before you commit.
3. **Check.** The studio scores scan readability from 0 to 100% and warns about risky choices such as low contrast, tight margins or an oversized logo. A scan test animation runs on demand.
4. **Export.** Download as PNG, JPG or SVG, copy the QR data, or share it. Recent downloads can be reloaded or saved again.

```text
User input → Validation → Payload → QR generation → Live preview
                                                        ↓
                          Download / Copy / Share ← Readability analysis
```

---

## Features

- QR codes for Link, Text, Email, Phone and Wi-Fi
- Input validation with clear error messages
- Live preview that updates as settings change
- Six dot styles: square, dots, rounded, extra rounded, classy, classy rounded
- Three corner styles: square, dot, extra rounded
- Foreground, background and gradient colors
- Error correction levels L, M, Q and H
- Adjustable size and margin
- Logo upload (under 1 MB), with error correction switched to H automatically
- Presets: Classic, Ink, Cobalt, Ember
- Scan readability score with a grade and a per-factor breakdown
- On-demand scan test animation
- QR details panel: grid size, version, data length, print size and scan distance
- Download as PNG, JPG or SVG, with file size shown for each format
- Copy QR data and share through the native share sheet where supported
- Recent downloads (last 5) stored locally, with reload and save-again
- Dark and light themes
- Responsive layout
- Reduced-motion support

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React |
| Language | TypeScript |
| Build tool | Vite |
| QR generation | `qr-code-styling` |
| Scroll film | Canvas 2D with a hand-written perspective camera |
| Styling | CSS |
| Browser APIs | Local storage, File API, Clipboard, Web Share |
| Hosting | Vercel |

---

## Scroll Film

The landing experience is a pinned canvas on a tall scroll runway. The scroll position becomes a single value from 0 to 1, and every frame of the film is drawn from that value.

- Chapters: Intro, Gather, Depth, Style, Scan, Export and Studio
- Modules scatter, lock into a grid, rise into 3D, change style, then get scanned by a light beam
- A live readability counter runs during the scan chapter
- No image sequences or video files are downloaded, so it stays sharp at any resolution
- Pointer movement adds a small camera parallax
- A chapter rail lets visitors jump between sections, and a "Skip to studio" button bypasses the film

---

## Setup

**Requirements:** Node.js 18 or newer, npm and Git.

```bash
git clone https://github.com/TSsanjayy/QR-Code-Generator.git
cd QR-Code-Generator/qr-designer
npm install
npm run dev
```

Open the URL shown in the terminal, usually `http://localhost:5173`.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |

No environment variables are required.

---

## Using the Studio

| Area | What it does |
|---|---|
| Type rail (left) | Switch between Link, Text, Email, Phone and Wi-Fi |
| Canvas (center) | Live QR preview, readability pill, format switch and download, share and copy buttons |
| Inspector (right) | Content, Style and Logo tabs |
| Top bar | Recent downloads, theme toggle and reset |

**Content tab:** enter the details, then review what scanning will do, the readability breakdown, QR details, quick-save sizes and the raw data.

**Style tab:** presets, dot, corner and error-correction tiles, colors, gradient, size and margin.

**Logo tab:** upload an image and adjust its size. Error correction switches to H for you.

---

## QR Payload Formats

| Type | Payload |
|---|---|
| Link | The URL as entered |
| Text | The text as entered |
| Email | `mailto:name@example.com` |
| Phone | `tel:+911234567890` |
| Wi-Fi | `WIFI:T:<WPA\|WEP\|nopass>;S:<network>;P:<password>;;` |

---

## Scan Readability Score

The score is a weighted estimate of how reliably a code will scan.

| Factor | Weight | What it measures |
|---|:---:|---|
| Contrast | 35% | Contrast ratio between code and background (7:1 or higher is ideal) |
| Size | 20% | Printed size, assuming 300 dpi |
| Margin | 15% | Quiet-zone width |
| Density | 15% | QR version, derived from the amount of data |
| Error correction | 15% | Chosen level, penalized when a logo is used without level H |

Penalties apply for light-on-dark (inverted) codes and oversized logos.

| Score | Grade |
|:---:|---|
| 85 to 100 | Excellent |
| 70 to 84 | Good |
| 50 to 69 | Fair |
| 0 to 49 | Poor |

Warnings appear for low contrast, light-on-dark codes, very small sizes, small margins, a lot of data at a small size, a logo without H error correction, and a very large logo.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl` / `⌘` + `S` | Download the current code |
| `Esc` | Close the Recent downloads panel |
| `↑` / `↓` | Move between rows in Recent downloads |

---

## Privacy

- QR generation and customization run entirely in the browser.
- There is no application backend and no account.
- Recent designs are stored in local browser storage on your device.
- Wi-Fi passwords are never stored in the recent list.
- Logos are not saved to history.
- Avoid putting confidential information in QR codes you plan to share publicly, because anyone who scans a code can read its contents.

---

## Design Decisions and Assumptions

- **Client-only.** QR generation does not need a server, so nothing leaves the device.
- **Readability as guidance.** The score combines simple, explainable factors instead of claiming exact scan prediction.
- **One place for options.** The same options builder drives the live preview and "save again", so exports match what you see.
- **Previews before commitment.** Hovering a style previews it on the real code, and clicking applies it.
- **Logos force level H.** A logo covers modules, so higher error correction is applied automatically.
- **Local history only.** Recent designs live in the browser, capped at five, with no sync.
- **Assumption:** print size is estimated at 300 dpi.
- **Assumption:** scan distance is estimated from print size, as a rough guide.

---

## Deployment

The app is deployed on Vercel. Because the project lives in a subdirectory, use these settings:

| Setting | Value |
|---|---|
| Framework | Vite |
| Root Directory | `qr-designer` |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Pushing to the production branch triggers a new deployment.

---

## Project Structure

```text
qr-designer/
├── src/
│   ├── utils/
│   │   └── payload.ts        # Payload building and validation
│   ├── App.tsx               # Studio UI and page composition
│   ├── App.css               # Studio styles
│   ├── ScrollStory.tsx       # Scroll film and chapters
│   ├── ScrollStory.css       # Film styles
│   ├── scene.ts              # Procedural 3D scene renderer
│   ├── theme.css             # Shared theme styling
│   ├── polish.css            # Visual refinements
│   └── main.tsx              # Entry point
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

This is a representative overview. Exact files may change as the project evolves.

---

## Roadmap

- More QR content types and export options
- More presets and customization controls
- Accessibility and mobile usability improvements
- Automated tests for validation, customization and downloads
- More advanced readability analysis

---

## Author

**Sanjay TS**

- GitHub: [@TSsanjayy](https://github.com/TSsanjayy)
- Repository: [QR-Code-Generator](https://github.com/TSsanjayy/QR-Code-Generator)
- Live demo: [Modul QR Designer](https://qr-code-generator-theta-ashen.vercel.app)

---

## License

Built for educational and demonstration purposes.
