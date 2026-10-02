import type { QRType, Fields } from "./payload";

export interface RecentQR {
  id: string;
  type: QRType;
  fields: Fields;
  settings: {
    size: number;
    fg: string;
    bg: string;
    ecc: "L" | "M" | "Q" | "H";
    margin: number;

    dotType:
      | "square"
      | "rounded"
      | "dots"
      | "classy"
      | "classy-rounded";

    cornerType:
      | "square"
      | "dot"
      | "extra-rounded";

    useGradient: boolean;
    gradientStart: string;
    gradientEnd: string;

    logo: string;
    logoSize: number;
    hideBackgroundDots: boolean;
  };
  timestamp: number;
}

const STORAGE_KEY = "qr-designer-recent";
const MAX_RECENT = 10;

export function getRecentQRs(): RecentQR[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return [];
    }

    return JSON.parse(saved);
  } catch {
    return [];
  }
}

export function saveRecentQR(qr: RecentQR): void {
  const existing = getRecentQRs();

  const updated = [
    qr,
    ...existing.filter((item) => item.id !== qr.id),
  ].slice(0, MAX_RECENT);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(updated)
  );
}

export function clearRecentQRs(): void {
  localStorage.removeItem(STORAGE_KEY);
}