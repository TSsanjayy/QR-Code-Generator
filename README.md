# QR Designer - Modul

**Design. Customize. Scan.**

[**Live Demo:**](https://qr-code-generator-theta-ashen.vercel.app/)**&#x20;-> [https://qr-code-generator-theta-ashen.vercel.app/](https://qr-code-generator-theta-ashen.vercel.app/)

[**GitHub Repository:**](https://github.com/TSsanjayy/QR-Code-Generator)**&#x20;-> [https://github.com/TSsanjayy/QR-Code-Generator](https://github.com/TSsanjayy/QR-Code-Generator)

---

## Overview

QR Designer is a web application for creating and personalizing QR codes without requiring a custom backend. Users can generate QR codes for different types of information, customize their appearance, preview changes instantly, and export their designs.

The project focuses on combining creative freedom with practical features that help users make QR codes easier to scan.

## Features

### QR Code Generation

- Generate QR codes for URLs and plain text.
- Create QR codes for email addresses and phone numbers.
- Generate Wi-Fi QR codes with network and security details.
- Validate inputs and display helpful error messages.
- Preview QR codes as settings change.

### Customization

- Adjust QR code size and margins.
- Customize foreground and background colors.
- Apply gradient colors.
- Choose different dot and corner styles.
- Configure error correction levels.
- Upload a logo to personalize QR codes.
- Apply predefined presets and modify them further.

### Scan Readability

- Calculate color contrast ratios.
- Identify customization choices that may affect scanning.
- Display warnings for potentially low contrast, insufficient margins, and other readability concerns.
- Provide guidance on error correction when using logos.

*Readability checks provide guidance and do not guarantee successful scanning on every device.*

### Export and Convenience

- Download QR codes in supported formats, including PNG and SVG.
- Copy or share where supported by the browser.
- Access recent QR codes through browser storage.
- Reuse previously generated designs.

### User Experience

- Responsive interface for different screen sizes.
- Interactive controls and live previews.
- Theme styling and animated interface elements.

---

## Technology Stack

| Technology        | Purpose                                                                         |
| ----------------- | ------------------------------------------------------------------------------- |
| React             | Component-based user interface                                                  |
| TypeScript        | Type safety and maintainable code                                               |
| Vite              | Development server and production builds                                        |
| CSS               | Layout, styling, themes, and animations                                         |
| `qr-code-styling` | QR generation and visual customization                                          |
| Browser APIs      | Local storage, file handling, and clipboard or sharing features where supported |
| Vercel            | Deployment and hosting                                                          |

---

## Architecture

```text
User Input
    ↓
Input Validation
    ↓
Payload Construction
    ↓
QR Code Generation
    ↓
Live Preview and Customization
    ↓
Readability Analysis
    ↓
Download / Copy / Share
```

The application processes QR content and customization in the browser. Local browser storage can be used for retaining recent designs.

---

## Project Structure

```text
qr-designer/
├── src/
│   ├── utils/
│   │   ├── payload.ts
│   │   ├── readability.ts
│   │   └── recent.ts
│   ├── App.tsx
│   ├── App.css
│   ├── Intro.tsx
│   ├── Scene.tsx
│   ├── ScrollStory.tsx
│   ├── Verdict.tsx
│   ├── presets.ts
│   ├── theme.css
│   ├── readability.css
│   ├── polish.css
│   ├── fx.tsx
│   ├── fx.css
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

*This is a representative overview of the main source files. The exact structure may vary as the project evolves.*

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) — LTS recommended
- npm
- Git

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/TSsanjayy/QR-Code-Generator.git
```

**2. Navigate to the application directory**

```bash
cd QR-Code-Generator/qr-designer
```

**3. Install dependencies**

```bash
npm install
```

**4. Start the development server**

```bash
npm run dev
```

Open the local URL displayed in the terminal, usually `http://localhost:5173/`.

Keep the terminal open while the development server is running.

---

## Production Build

Build the application:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

The generated production files are placed in the `dist/` directory.

---

## Deployment

QR Designer is deployed using Vercel.

If the application is located inside the `qr-designer` subdirectory, use the following configuration:

| Setting          | Value           |
| ---------------- | --------------- |
| Framework        | Vite            |
| Root Directory   | `qr-designer`   |
| Install Command  | `npm install`   |
| Build Command    | `npm run build` |
| Output Directory | `dist`          |

Push committed changes to the production branch connected to Vercel and verify that the latest deployment completes successfully.

**Live application:** [https://qr-code-generator-theta-ashen.vercel.app/](https://qr-code-generator-theta-ashen.vercel.app/)

---

## Privacy

Core QR generation and customization run in the browser without a custom application backend. Recent designs may be retained in local browser storage.

Avoid including confidential information or sensitive credentials in QR codes intended for public distribution.

---

## Future Improvements

- Additional QR code types and export options.
- More visual presets and customization controls.
- Improved accessibility and mobile usability.
- Automated tests for validation, customization, and downloads.
- Enhanced readability analysis and scanning guidance.

---

## Author

**Sanjay TS**

- **GitHub:** [@TSsanjayy](https://github.com/TSsanjayy)
- **Repository:** [QR-Code-Generator](https://github.com/TSsanjayy/QR-Code-Generator)
- **Live Demo:** [QR Designer](https://qr-code-generator-theta-ashen.vercel.app/)
