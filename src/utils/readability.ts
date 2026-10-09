// Real scan test: decode the rendered QR under stress and report what survives.
// npm i jsqr
import jsQR from "jsqr";
import type QRCodeStyling from "qr-code-styling";

export interface Check { k: string; label: string; pass: boolean }

const BASE = 480; // work on a bounded copy so slider drags stay smooth
const canvas = (w: number) => Object.assign(document.createElement("canvas"), { width: Math.max(24, Math.round(w)), height: Math.max(24, Math.round(w)) });
const ctxOf = (c: HTMLCanvasElement) => c.getContext("2d", { willReadFrequently: true })!;
const pause = () => new Promise((r) => setTimeout(r, 0));

function scaled(src: CanvasImageSource, to: number) {
  const c = canvas(to), x = ctxOf(c);
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
const copy = (b: HTMLCanvasElement) => scaled(b, b.width);
const bgOf = (b: HTMLCanvasElement) => { const d = ctxOf(b).getImageData(1, 1, 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})`; };

// "dontInvert" matches strict scanners: light-on-dark codes should fail here
function reads(c: HTMLCanvasElement, expected: string) {
  const { data, width, height } = ctxOf(c).getImageData(0, 0, c.width, c.height);
  return jsQR(data, width, height, { inversionAttempts: "dontInvert" })?.data === expected;
}

const TESTS: { k: string; label: string; make: (b: HTMLCanvasElement) => HTMLCanvasElement }[] = [
  { k: "clean", label: "As designed", make: (b) => b },
  { k: "far", label: "Far away", make: (b) => scaled(b, b.width * 0.22) },
  { k: "soft", label: "Out of focus", make: (b) => scaled(scaled(b, b.width * 0.3), b.width) },
  { k: "dim", label: "Low light", make: (b) => {
    const c = copy(b), x = ctxOf(c);
    x.fillStyle = "rgba(120,120,120,.55)"; x.fillRect(0, 0, c.width, c.height);
    return c;
  } },
  { k: "tilt", label: "Tilted", make: (b) => {
    const n = Math.ceil(b.width * 1.42), c = canvas(n), x = ctxOf(c);
    x.fillStyle = bgOf(b); x.fillRect(0, 0, n, n);
    x.translate(n / 2, n / 2); x.rotate(0.26); x.drawImage(b, -b.width / 2, -b.height / 2);
    return c;
  } },
  { k: "noise", label: "Grainy", make: (b) => {
    const c = copy(b), x = ctxOf(c), im = x.getImageData(0, 0, c.width, c.height);
    let s = 7;
    for (let i = 0; i < im.data.length; i += 4) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const n = ((s >>> 24) - 128) * 0.4;
      im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n;
    }
    x.putImageData(im, 0, 0);
    return c;
  } },
];

export async function runProbe(qr: QRCodeStyling, expected: string): Promise<Check[] | null> {
  try {
    const blob = (await qr.getRawData("png")) as Blob | null;
    if (!blob) return null;
    const bmp = await createImageBitmap(blob);
    const base = scaled(bmp, Math.min(bmp.width, BASE));
    bmp.close();
    const out: Check[] = [];
    for (const t of TESTS) {
      await pause(); // keep the UI responsive between decodes
      out.push({ k: t.k, label: t.label, pass: reads(t.make(base), expected) });
    }
    return out;
  } catch { return null; }
}