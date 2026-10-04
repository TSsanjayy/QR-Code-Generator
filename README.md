# QR Designer

A modern, browser-based QR code generator and designer that lets you create, customize, preview, download, and share QR codes in real time.

## ✨ Features

- 🔗 **Multiple QR Types**
  - URL
  - Text
  - Email
  - Phone
  - Wi-Fi

- 🎨 **QR Customization**
  - QR size
  - Margin
  - Foreground & background colors
  - Gradient colors
  - Dot styles
  - Corner styles
  - Error correction levels

- 🖼️ **Logo Support**
  - Upload a custom logo
  - Add a logo using a URL
  - Automatic error-correction adjustment for logos

- 👀 **Live Preview**
  - Real-time QR code generation
  - Scan-quality indicator
  - Contrast ratio display
  - Pixel-style scan status animation

- 📥 **Export**
  - PNG
  - JPG
  - SVG

- 📤 **Share & Copy**
  - Share generated QR codes
  - Copy QR data directly

- 🌙 **Dark Mode**
  - Switch between light and dark themes

- 📱 **Responsive UI**
  - Designed to work across desktop and smaller screens

## 🛠️ Tech Stack

- React
- TypeScript
- Vite
- CSS
- `qr-code-styling`

## 🚀 Getting Started

### Prerequisites

Make sure you have Node.js and npm installed.

### Installation

Clone the repository:

```bash
git clone <YOUR_REPOSITORY_URL>
```

Navigate into the project:

```bash
cd qr-designer
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown in the terminal.

## 📦 Production Build

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## 🌐 Deployment

The application can be deployed as a static frontend using platforms such as Vercel.

The project requires no backend for QR generation. QR creation and customization are handled directly in the browser.

## 📁 Project Structure

```text
qr-designer/
├── public/
├── src/
│   ├── App.tsx
│   ├── App.css
│   ├── Verdict.tsx
│   ├── Verdict.css
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🔒 Privacy

QR data is processed directly in the browser. No backend database is required to generate QR codes.

## 🎯 Project Goal

QR Designer was built to provide a simple but powerful alternative to basic QR generators by combining QR generation with detailed visual customization, live feedback, and a modern design-focused interface.

## 📄 License

This project is available for educational and personal use.