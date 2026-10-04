import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import QRCodeStyling from "qr-code-styling";
import { buildPayload, validate, emptyFields, type QRType, type Fields } from "./utils/payload";
import "./App.css";

/* =========================================================
   TYPES & DATA
   ========================================================= */

type ECC = "L" | "M" | "Q" | "H";
type Dot = "square" | "dots" | "rounded" | "extra-rounded" | "classy" | "classy-rounded";
type Corner = "square" | "dot" | "extra-rounded";
type Fmt = "png" | "jpeg" | "svg";
type Tab = "content" | "style" | "logo";

interface S {
  size: number; margin: number; fg: string; bg: string; ecc: ECC; dot: Dot; corner: Corner;
  grad: boolean; g1: string; g2: string; logo: string; logoSize: number;
}
interface Recent { id: number; type: QRType; data: string; s: S; at: number }

const DEFAULTS: S = {
  size: 400, margin: 12, fg: "#111729", bg: "#ffffff", ecc: "M", dot: "rounded", corner: "extra-rounded",
  grad: false, g1: "#1f3bff", g2: "#9333ea", logo: "", logoSize: 0.3,
};

const PRESETS: { name: string; s: Partial<S> }[] = [
  { name: "Classic", s: { fg: "#000000", bg: "#ffffff", grad: false, dot: "square", corner: "square" } },
  { name: "Ink", s: { fg: "#111729", bg: "#eef0f5", grad: false, dot: "rounded", corner: "extra-rounded" } },
  { name: "Cobalt", s: { bg: "#ffffff", grad: true, g1: "#1f3bff", g2: "#7c3aed", dot: "rounded", corner: "extra-rounded", ecc: "Q" } },
  { name: "Ember", s: { bg: "#fffaf2", grad: true, g1: "#c2410c", g2: "#be123c", dot: "dots", corner: "dot", ecc: "Q" } },
];

const TYPES: { v: QRType; label: string }[] = [
  { v: "url", label: "Link" }, { v: "text", label: "Text" }, { v: "email", label: "Email" },
  { v: "phone", label: "Phone" }, { v: "wifi", label: "Wi-Fi" },
];
const SIMPLE: Partial<Record<QRType, { key: keyof Fields; label: string; ph: string }>> = {
  url: { key: "url", label: "Website address", ph: "https://example.com" },
  text: { key: "text", label: "Message", ph: "Anything you want to share" },
  email: { key: "email", label: "Email address", ph: "name@example.com" },
  phone: { key: "phone", label: "Phone number", ph: "+91 98765 43210" },
};
const FORMATS: { v: Fmt; label: string; desc: string }[] = [
  { v: "png", label: "PNG", desc: "Lossless · web & print" },
  { v: "jpeg", label: "JPG", desc: "Smaller · no transparency" },
  { v: "svg", label: "SVG", desc: "Vector · scales forever" },
];
const SECURITY: { v: Fields["security"]; label: string }[] = [
  { v: "WPA", label: "WPA" }, { v: "WEP", label: "WEP" }, { v: "nopass", label: "Open" },
];
const TABS: Tab[] = ["content", "style", "logo"];
const DOTS: Dot[] = ["square", "dots", "rounded", "extra-rounded", "classy", "classy-rounded"];
const CORNERS: Corner[] = ["square", "dot", "extra-rounded"];
const DR: Record<Dot, string> = { square: "0", dots: "50%", rounded: "28%", "extra-rounded": "42%", classy: "0 60% 0 60%", "classy-rounded": "30% 62% 30% 62%" };
const CR: Record<Corner, string> = { square: "0", dot: "50%", "extra-rounded": "34%" };

/* =========================================================
   ICONS
   ========================================================= */

const ICONS: Record<QRType, ReactNode> = {
  url: <path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" />,
  text: <path d="M4 6h16M4 12h16M4 18h10" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />,
  wifi: <><path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0" /><circle cx="12" cy="19" r="1" /></>,
};

const BTN_ICONS = {
  download: <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" />,
  share: <path d="M12 15V4m0 0L8 8m4-4l4 4M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  reset: <path d="M4 12a8 8 0 108-8H8m0 0l3-3M8 4l3 3" />,
  moon: <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
} satisfies Record<string, ReactNode>;

function Ico({ k }: { k: keyof typeof BTN_ICONS }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {BTN_ICONS[k]}
    </svg>
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

const vars = (o: Record<string, string | number>) => o as CSSProperties;
const pretty = (x: string) => x.replace("-", " ").replace(/^./, (c) => c.toUpperCase());
const fmtSize = (b: number) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`);
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : new Date(t).toLocaleDateString();
};

function lum(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrastOf = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// pixel "M" for the logo; a scan pass lights the modules in turn
const M_GLYPH = [1,0,0,0,1, 1,1,0,1,1, 1,0,1,0,1, 1,0,0,0,1, 1,0,0,0,1];

// the verdict pill shows a tiny QR whose modules are derived from your content:
// a 4×4 finder block on the left, data modules (seeded by the payload) on the right
const MC = 14, MR = 4;
function matrixFor(payload: string) {
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) { h ^= payload.charCodeAt(i); h = Math.imul(h, 16777619); }
  let seed = (h >>> 0) || 1;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const cells = Array.from({ length: MC * MR }, (_, i) => {
    const c = i % MC, r = Math.floor(i / MC);
    const fin = c < 4;
    const on = fin ? r === 0 || r === 3 || c === 0 || c === 3 : rnd() > 0.45;
    return { on, fin, f: rnd() };
  });
  // data modules in a stable "damage order" so warnings corrupt the same cells every time
  const order = cells.map((_, i) => i).filter((i) => !cells[i].fin && cells[i].on).sort((a, b) => cells[a].f - cells[b].f);
  return { cells, order };
}

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      {M_GLYPH.map((on, i) => <i key={i} className={on ? "on" : ""} style={vars({ "--d": `${(i % 5) * 0.16}s` })} />)}
    </span>
  );
}

/* =========================================================
   APP
   ========================================================= */

export default function App() {
  /* ---------- state ---------- */
  const [type, setType] = useState<QRType>("url");
  const [fields, setFields] = useState<Fields>({ ...emptyFields, url: "https://example.com" });
  const [s, setS] = useState<S>(DEFAULTS);
  const [preset, setPreset] = useState<string | null>(null);
  const [hover, setHover] = useState<Partial<S> | null>(null);
  const [modules, setModules] = useState(0);
  const [tab, setTab] = useState<Tab>("content");
  const [touched, setTouched] = useState(false);
  const [fmt, setFmt] = useState<Fmt>("png");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [dlPhase, setDlPhase] = useState<"idle" | "busy" | "done">("idle");
  const [dlInfo, setDlInfo] = useState<{ size: string } | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sizes, setSizes] = useState<Partial<Record<Fmt, string>>>({});
  const [recBump, setRecBump] = useState(0);
  const [recPulse, setRecPulse] = useState(false);
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("qr-theme");
      if (saved) return saved === "dark";
    } catch { /* storage blocked */ }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  const [recent, setRecent] = useState<Recent[]>(() => {
    try {
      const l = JSON.parse(localStorage.getItem("recentQRs") || "[]");
      return Array.isArray(l) ? l.filter((r) => r && r.s && r.data && r.type) : [];
    } catch { return []; }
  });

  /* ---------- refs ---------- */
  const host = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<HTMLDivElement>(null);
  const recBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pulseTimer = useRef(0);
  const canvasRef = useRef<HTMLElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const eyeRef = useRef<HTMLSpanElement>(null);
  const downloadRef = useRef<() => void>(() => {});
  const dlTimers = useRef<number[]>([]);
  const noteTimer = useRef(0);
  const copyTimer = useRef(0);
  const qr = useRef<QRCodeStyling | null>(null);
  if (!qr.current) qr.current = new QRCodeStyling({ type: "canvas", data: " ", width: 400, height: 400 });

  /* ---------- derived ---------- */
  const v = useMemo<S>(() => (hover ? { ...s, ...hover } : s), [s, hover]); // what the preview shows
  const previewing = !!hover;
  const error = validate(type, fields);
  const payload = useMemo(() => (error ? "" : buildPayload(type, fields)), [type, fields, error]);
  const simple = SIMPLE[type];

  const tones = v.grad ? [v.g1, v.g2] : [v.fg];
  const contrast = Math.min(...tones.map((c) => contrastOf(c, v.bg)));
  const warns: string[] = [];
  if (contrast < 4) warns.push(`Low contrast (${contrast.toFixed(1)}:1)`);
  if (tones.some((c) => lum(c) > lum(v.bg))) warns.push("Light-on-dark fails in some scanners");
  if (v.size < 200) warns.push("Very small size");
  if (v.margin < 4) warns.push("Margin too small");
  if (payload.length > 300 && v.size < 300) warns.push("Lots of data for this size");
  if (v.logo && v.ecc !== "H") warns.push("Use H error correction with a logo");
  if (v.logo && v.logoSize > 0.35) warns.push("Logo is very large");
  const mx = useMemo(() => matrixFor(payload), [payload]);
  const badIdx = new Set(mx.order.slice(0, Math.min(10, warns.length * 3))); // each warning "damages" 3 modules

  /* ---------- simulated scan test: every design change re-runs it ---------- */
  const wasPreview = useRef(false);
  const sig = [previewing, payload, v.size, v.margin, v.ecc, v.dot, v.corner, v.fg, v.bg, v.grad, v.g1, v.g2, v.logo.length, v.logoSize].join("|");
  const [phase, setPhase] = useState<"testing" | "done">("done");
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ k: "ok" | "warn"; n: number } | null>(null);
  const warnCount = useRef(0);
  warnCount.current = warns.length;
  const testingUI = phase === "testing" && !previewing; // previews show the live result straight away

  useEffect(() => {
    if (!result) return;
    const id = window.setTimeout(() => setResult(null), 2400);
    return () => window.clearTimeout(id);
  }, [result]);

  useEffect(() => {
    if (!payload) { setPhase("done"); return; }
    const quick = previewing || wasPreview.current; // previews get a short pass, real edits the full test
    wasPreview.current = previewing;
    let end = 0;
    const start = window.setTimeout(() => {
      setPhase("testing");
      setRun((r) => r + 1);
      if (!quick) setResult(null);
      end = window.setTimeout(() => {
        setPhase("done");
        if (!quick) setResult({ k: warnCount.current ? "warn" : "ok", n: Date.now() });
      }, quick ? 380 : 1250);
    }, quick ? 70 : 0);
    return () => { window.clearTimeout(start); window.clearTimeout(end); };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- QR instance ---------- */
  useEffect(() => {
    const el = host.current;
    if (el && qr.current) { el.innerHTML = ""; qr.current.append(el); }
    return () => { if (el) el.innerHTML = ""; };
  }, []);

  useEffect(() => {
    if (!payload || !qr.current) return;
    const fill = {
      color: v.fg,
      gradient: v.grad
        ? { type: "linear" as const, rotation: Math.PI / 4, colorStops: [{ offset: 0, color: v.g1 }, { offset: 1, color: v.g2 }] }
        : undefined,
    };
    qr.current.update({
      data: payload, width: v.size, height: v.size, margin: v.margin,
      qrOptions: { errorCorrectionLevel: v.ecc },
      dotsOptions: { ...fill, type: v.dot },
      cornersSquareOptions: { ...fill, type: v.corner },
      cornersDotOptions: { ...fill, type: v.corner === "dot" ? "dot" : "square" },
      backgroundOptions: { color: v.bg },
      image: v.logo || undefined,
      imageOptions: { crossOrigin: "anonymous", margin: 4, imageSize: v.logoSize, hideBackgroundDots: true },
    });
    // module count lets the scan animation size the finder-pattern lock boxes
    const q = (qr.current as unknown as { _qr?: { getModuleCount: () => number } })._qr;
    if (q) setModules(q.getModuleCount());
  }, [payload, v]);

  /* ---------- persistence & global listeners ---------- */
  useEffect(() => {
    try { localStorage.setItem("qr-theme", dark ? "dark" : "light"); } catch { /* ignore */ }
  }, [dark]);

  useEffect(() => () => {
    dlTimers.current.forEach((id) => window.clearTimeout(id));
    window.clearTimeout(noteTimer.current);
    window.clearTimeout(copyTimer.current);
    window.clearTimeout(pulseTimer.current);
  }, []);

  useEffect(() => {
    if (!recOpen) return;
    const down = (e: MouseEvent) => { if (!recRef.current?.contains(e.target as Node)) setRecOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setRecOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [recOpen]);

  // format menu: close on outside click / Esc, and measure each format's file size
  useEffect(() => {
    if (!menuOpen) return;
    let alive = true;
    setSizes({});
    FORMATS.forEach(({ v: f }) => {
      qr.current?.getRawData(f).then((b) => {
        if (alive && b) setSizes((p) => ({ ...p, [f]: fmtSize((b as Blob).size) }));
      }).catch(() => { /* size is optional */ });
    });
    const down = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { alive = false; document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [menuOpen]);

  // Ctrl / ⌘ + S downloads
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); downloadRef.current(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  // the "o" in the wordmark is an eye that follows your cursor
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const el = eyeRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const m = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, m / 180);
      el.style.setProperty("--ex", String((dx / m) * k));
      el.style.setProperty("--ey", String((dy / m) * k));
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  /* ---------- canvas pointer FX: tilt, glare, ruler ticks, coordinates ---------- */
  const onCanvasMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = canvasRef.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    el.style.setProperty("--mx", `${x}px`);
    el.style.setProperty("--my", `${y}px`);
    el.style.setProperty("--gx", `${(x / r.width) * 100}%`);
    el.style.setProperty("--gy", `${(y / r.height) * 100}%`);
    el.style.setProperty("--rx", `${(y / r.height - 0.5) * -7}deg`);
    el.style.setProperty("--ry", `${(x / r.width - 0.5) * 9}deg`);
    if (coordRef.current) coordRef.current.textContent = `x ${Math.round(x)}  y ${Math.round(y)}`;
  };
  const onCanvasLeave = () => {
    canvasRef.current?.style.setProperty("--rx", "0deg");
    canvasRef.current?.style.setProperty("--ry", "0deg");
  };

  /* ---------- actions ---------- */
  const set = <K extends keyof S>(k: K, val: S[K]) => { setS((p) => ({ ...p, [k]: val })); setPreset(null); };
  const setField = (k: keyof Fields, val: string) => setFields((p) => ({ ...p, [k]: val }));
  const flash = (t: string) => {
    setNote(t);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(""), 2200);
  };
  const store = (l: Recent[]) => { setRecent(l); try { localStorage.setItem("recentQRs", JSON.stringify(l)); } catch { /* ignore */ } };

  // the finished code shrinks and flies into the "Recent" button, which pulses on arrival
  const flyToRecent = () => {
    const canvas = host.current?.querySelector("canvas");
    const target = recBtnRef.current;
    if (!canvas || !target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      const a = canvas.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const img = document.createElement("img");
      img.src = canvas.toDataURL();
      Object.assign(img.style, {
        position: "fixed", left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`,
        zIndex: "100", pointerEvents: "none", borderRadius: "4px", background: "#fff",
        boxShadow: "0 24px 40px -12px rgba(0,0,0,.45)",
      });
      document.body.appendChild(img);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const anim = img.animate([
        { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx * 0.35}px, ${dy * 0.35 + 40}px) scale(.5) rotate(-6deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${dx}px, ${dy}px) scale(.04) rotate(10deg)`, opacity: 0.3 },
      ], { duration: 850, easing: "cubic-bezier(.55,0,.25,1)" });
      const land = () => {
        img.remove();
        setRecBump((n) => n + 1);
        setRecPulse(true);
        window.clearTimeout(pulseTimer.current);
        pulseTimer.current = window.setTimeout(() => setRecPulse(false), 600);
      };
      anim.onfinish = land;
      anim.oncancel = () => img.remove();
    } catch { /* tainted canvas (cross-origin logo) — skip the flourish */ }
  };

  const download = (f: Fmt = fmt) => {
    if (!payload || !qr.current) return;
    setFmt(f);
    qr.current.download({ name: `qr-${type}`, extension: f });
    const data = type === "wifi" ? payload.replace(/;P:.*;;$/, ";P:;;") : payload; // never keep Wi-Fi passwords
    store([{ id: Date.now(), type, data, s: { ...s, logo: "" }, at: Date.now() }, ...recent.filter((r) => r.data !== data || r.type !== type)].slice(0, 5));
    flyToRecent();
    dlTimers.current.forEach((id) => window.clearTimeout(id));
    setDlInfo({ size: "" });
    setDlPhase("busy");
    qr.current.getRawData(f).then((b) => {
      if (b) setDlInfo((p) => (p ? { ...p, size: fmtSize((b as Blob).size) } : p));
    }).catch(() => { /* size is optional */ });
    dlTimers.current = [
      window.setTimeout(() => setDlPhase("done"), 900),
      window.setTimeout(() => setDlPhase("idle"), 3000),
    ];
  };
  downloadRef.current = download;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch { flash("Clipboard blocked"); }
  };

  const share = async () => {
    if (!payload || !qr.current) return;
    try {
      const blob = await qr.current.getRawData("png");
      if (!blob) return;
      const file = new File([blob as BlobPart], "qr.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else { qr.current.download({ name: "qr", extension: "png" }); flash("Sharing unavailable · saved instead"); }
    } catch { /* cancelled */ }
  };

  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 1048576) { flash("Images under 1 MB only"); e.target.value = ""; return; }
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result !== "string") return;
      setS((p) => ({ ...p, logo: r.result as string, ecc: "H", logoSize: Math.min(p.logoSize, 0.3) }));
      setPreset(null);
    };
    r.readAsDataURL(f);
  };

  const reuse = (r: Recent) => {
    const f = { ...emptyFields };
    if (r.type === "url" || r.type === "text") f[r.type] = r.data;
    if (r.type === "email") f.email = r.data.replace("mailto:", "");
    if (r.type === "phone") f.phone = r.data.replace("tel:", "");
    if (r.type === "wifi") {
      const m = r.data.match(/^WIFI:T:([^;]*);S:(.*);P:(.*);;$/);
      if (m) { f.security = m[1] as Fields["security"]; f.ssid = m[2]; f.password = m[3]; }
    }
    setType(r.type); setFields(f); setS(r.s); setPreset(null); setTouched(r.type === "wifi"); setTab("content"); setRecOpen(false);
  };

  const reset = () => {
    setType("url"); setFields({ ...emptyFields, url: "https://example.com" });
    setS(DEFAULTS); setPreset(null); setTouched(false);
  };

  // theme switch: a circular wipe that grows from the button (falls back to an instant swap)
  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const r = e.currentTarget.getBoundingClientRect();
    document.documentElement.style.setProperty("--tx", `${r.left + r.width / 2}px`);
    document.documentElement.style.setProperty("--ty", `${r.top + r.height / 2}px`);
    if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setDark((d) => !d); return; }
    doc.startViewTransition(() => flushSync(() => setDark((d) => !d)));
  };

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className={`app ${dark ? "dark" : ""}`}>
      {/* ---------- top bar ---------- */}
      <header className="bar">
        <div className="brand">
          <Mark />
          <b className="wm" aria-label="modul">m<span className="o" ref={eyeRef} aria-hidden="true" />dul</b>
          <em>QR studio</em>
        </div>

        <div className="barbtns">
          <div className="recwrap" ref={recRef}>
            <button ref={recBtnRef} className={`plain ${recPulse ? "bump" : ""}`} aria-expanded={recOpen} aria-haspopup="dialog" onClick={() => setRecOpen((o) => !o)}>
              <Ico k="clock" />Recent{recent.length > 0 && <em className="cnt" key={recBump}>{Math.min(recent.length, 5)}</em>}
            </button>
            {recOpen && (
              <div className="recpop" role="dialog" aria-label="Recent QR codes">
                <div className="rhead">
                  <h3>Last 5 downloads</h3>
                  {recent.length > 0 && <button className="linkbtn" onClick={() => store([])}>Clear</button>}
                </div>
                {recent.length === 0 ? (
                  <p className="rempty">Downloaded codes appear here.</p>
                ) : (
                  <ul className="rlist">
                    {recent.slice(0, 5).map((r, i) => (
                      <li key={r.id} style={vars({ "--n": i })}>
                        <button className="rl-main" onClick={() => reuse(r)} title="Load this design">
                          <i className="rl-dot" style={{ background: r.s.grad ? `linear-gradient(135deg, ${r.s.g1}, ${r.s.g2})` : r.s.fg }} />
                          <span className="rl-type">{r.type}</span>
                          <span className="rl-data">{r.data}</span>
                          <small>{ago(r.at)}</small>
                        </button>
                        <button className="rl-del" aria-label="Remove" onClick={() => store(recent.filter((x) => x.id !== r.id))}>✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <button className="plain" onClick={toggleTheme}><Ico k={dark ? "sun" : "moon"} />{dark ? "Light" : "Dark"}</button>
          <button className="plain" onClick={reset}><Ico k="reset" />Reset</button>
        </div>
      </header>

      <div className="body">
        {/* ---------- type rail ---------- */}
        <nav className="rail" aria-label="QR type">
          {TYPES.map((t, i) => (
            <button key={t.v} className={type === t.v ? "on" : ""} aria-pressed={type === t.v} style={vars({ "--n": i })}
              onClick={() => { setType(t.v); setTouched(false); setTab("content"); }}>
              <svg key={type === t.v ? "on" : "off"} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[t.v]}</svg>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* ---------- canvas ---------- */}
        <main className="canvas" ref={canvasRef} onPointerMove={onCanvasMove} onPointerLeave={onCanvasLeave}>
          <i className="tickx" aria-hidden="true" />
          <i className="ticky" aria-hidden="true" />
          <span className="coords" ref={coordRef} aria-hidden="true" />
          {hover && <div className="peek">Previewing · click to apply</div>}
          {note && <div className="toast" key={note} role="status">{note}</div>}

          <div className="stagewrap">
            <div className={`qrframe ${payload && phase === "testing" ? "testing" : ""} ${previewing ? "pv" : ""}`} data-size={`${v.size} × ${v.size} px`}>
              <div className={`qrcard ${payload ? "" : "stale"} ${previewing ? "preview" : ""}`}>
                <div ref={host} className="qr" />
                {payload && phase === "testing" && previewing && <span className="sweep pv" key={run} />}
                {payload && phase === "testing" && !previewing && (
                  <div className="scanfx" key={run} style={vars({ "--qm": `${(v.margin / v.size) * 100}%`, "--qf": `${(7 / (modules || 25)) * (1 - (2 * v.margin) / v.size) * 100}%` })}>
                    <i className="fd tl" /><i className="fd tr" /><i className="fd bl" />
                    <b className="laser" />
                  </div>
                )}
                {!payload && <p className="fix">Complete the details to update</p>}
              </div>

              {result && (
                <span key={result.n} className={`badge ${result.k}`} role="status" aria-label={result.k === "ok" ? "Scan test passed" : "Scan test found issues"}>
                  {result.k === "ok" ? (
                    <svg className="draw" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 12.6l3.6 3.6 7.4-7.8" pathLength="1" /></svg>
                  ) : (
                    <svg className="warnicon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 6.5v7M12 17.5v.01" /></svg>
                  )}
                </span>
              )}
            </div>

            <div className={`verdict ${!payload ? "idle" : testingUI ? "testing" : warns.length ? "bad" : "good"}`} title="Scan reliability" aria-live="polite">
              {!payload ? "Waiting for details" : (
                <>
                  <span className="mx" aria-hidden="true">
                    {mx.cells.map((c, i) => (
                      <i key={i} className={`${c.on ? "on" : ""} ${c.fin ? "fin" : ""} ${badIdx.has(i) ? "bad" : ""}`}
                        style={vars({ "--c": i % MC, "--r": Math.floor(i / MC), "--f": c.f.toFixed(3) })} />
                    ))}
                  </span>
                  <span className="stampslot">
                    {!testingUI && (
                      <svg key={warns.length ? "b" : "g"} className="stamp" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" pathLength="1" />
                        {warns.length ? <path d="M12 7.5v6M12 16.8v.01" pathLength="1" /> : <path d="M7.6 12.4l3 3 5.8-6.2" pathLength="1" />}
                      </svg>
                    )}
                  </span>
                  <span key={testingUI ? "r" : warns.length ? "b" : "g"} className="vstat">
                    {testingUI ? "Reading signal" : warns.length ? `${warns.length} to check` : `Scans well · ${contrast.toFixed(1)}:1`}
                  </span>
                </>
              )}
            </div>
            {warns.length > 0 && <ul className="warns">{warns.map((w) => <li key={w}>{w}</li>)}</ul>}
          </div>

          {/* ---------- dock ---------- */}
          <div className="dock">
            <div className={`dl ${dlPhase}`} ref={menuRef}>
              <button className="dl-main" disabled={!payload} onClick={() => download()} title="Download (Ctrl/⌘ + S)">
                <svg className="trayicon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {dlPhase === "done"
                    ? <path className="ck" d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" />
                    : <><path className="arrow" d="M12 3v11m0 0l-4-4m4 4l4-4" /><path d="M5 20h14" /></>}
                </svg>
                <span key={dlPhase} className="dl-label">
                  {dlPhase === "busy" ? "Saving…" : dlPhase === "done" ? `Saved${dlInfo?.size ? ` · ${dlInfo.size}` : ""}` : `Download ${fmt.toUpperCase()}`}
                </span>
                <i className="dl-bar" />
              </button>
              <button className="dl-caret" disabled={!payload} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Choose format" onClick={() => setMenuOpen((o) => !o)}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
              </button>

              {menuOpen && (
                <div className="dl-menu" role="menu" aria-label="Download format">
                  <p className="dl-head">Export as</p>
                  {FORMATS.map((f, i) => (
                    <button key={f.v} role="menuitemradio" aria-checked={fmt === f.v} className={`dl-item ${fmt === f.v ? "on" : ""}`} style={vars({ "--n": i })}
                      onClick={() => { setMenuOpen(false); download(f.v); }}>
                      <b>{f.label}</b><span>{f.desc}</span><em>{sizes[f.v] ?? "…"}</em>
                    </button>
                  ))}
                  <p className="dl-foot">Ctrl / ⌘ + S repeats your last format</p>
                </div>
              )}
            </div>

            <button className="plain" disabled={!payload} onClick={share}><Ico k="share" />Share</button>
            <button className={`plain ${copied ? "ok" : ""}`} disabled={!payload} onClick={copy}>
              {copied ? <><Ico k="check" />Copied</> : <><Ico k="copy" />Copy</>}
            </button>
          </div>
        </main>

        {/* ---------- inspector ---------- */}
        <aside className="inspector">
          <div className="itabs" role="tablist" style={vars({ "--n": TABS.length, "--i": TABS.indexOf(tab) })}>
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{pretty(t)}</button>
            ))}
          </div>

          <div className="ibody" key={tab + type}>
            {tab === "content" && (
              <div className="stack" onBlur={() => setTouched(true)}>
                {simple && <Field label={simple.label} ph={simple.ph} value={fields[simple.key]} onChange={(val) => setField(simple.key, val)} />}
                {type === "wifi" && (
                  <>
                    <Field label="Network name" ph="My Wi-Fi" value={fields.ssid} onChange={(val) => setField("ssid", val)} />
                    <Seg label="Security" value={fields.security} options={SECURITY} onChange={(val) => setField("security", val)} />
                    {fields.security !== "nopass" && <Field label="Password" ph="Wi-Fi password" secret value={fields.password} onChange={(val) => setField("password", val)} />}
                  </>
                )}
                {touched && error && <p className="err" role="alert">{error}</p>}
              </div>
            )}

            {tab === "style" && (
              <>
                <h3>Presets</h3>
                <div className="presets">
                  {PRESETS.map((p) => (
                    <button key={p.name} className={preset === p.name ? "on" : ""}
                      onClick={() => { setS((o) => ({ ...o, ...p.s })); setPreset(p.name); setHover(null); }}
                      onMouseEnter={() => setHover(p.s)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.s)} onBlur={() => setHover(null)}>
                      <i style={{ background: p.s.grad ? `linear-gradient(135deg, ${p.s.g1}, ${p.s.g2})` : p.s.fg }} />{p.name}
                    </button>
                  ))}
                </div>
                <Tiles label="Dot style" cols={3} value={s.dot} options={DOTS} onChange={(x) => set("dot", x)} onPreview={(x) => setHover(x ? { dot: x } : null)} glyph={(k) => <DotGlyph k={k} />} />
                <Tiles label="Corner style" cols={3} value={s.corner} options={CORNERS} onChange={(x) => set("corner", x)} onPreview={(x) => setHover(x ? { corner: x } : null)} glyph={(k) => <span className="cg" style={vars({ "--r": CR[k] })} />} />
                <Tiles label="Error correction" cols={4} value={s.ecc} options={["L", "M", "Q", "H"] as ECC[]} labelOf={(k) => ({ L: "7%", M: "15%", Q: "25%", H: "30%" })[k]} onChange={(x) => set("ecc", x)} onPreview={(x) => setHover(x ? { ecc: x } : null)} glyph={(k) => <b className="eccl">{k}</b>} />
                <div className="grid2">
                  <label className="toggle"><span>Gradient</span><input type="checkbox" checked={s.grad} onChange={(e) => set("grad", e.target.checked)} /></label>
                  {s.grad ? (
                    <><Swatch label="From" value={s.g1} onChange={(val) => set("g1", val)} /><Swatch label="To" value={s.g2} onChange={(val) => set("g2", val)} /></>
                  ) : <Swatch label="Foreground" value={s.fg} onChange={(val) => set("fg", val)} />}
                  <Swatch label="Background" value={s.bg} onChange={(val) => set("bg", val)} />
                </div>
                <Slide label="Size" unit="px" min={150} max={600} step={10} value={s.size} onChange={(val) => set("size", val)} />
                <Slide label="Margin" unit="px" min={0} max={40} value={s.margin} onChange={(val) => set("margin", val)} />
              </>
            )}

            {tab === "logo" && (
              <>
                <label className="drop">
                  <b>{s.logo ? "Change logo" : "Upload a logo"}</b><span>PNG, JPG or SVG · under 1 MB</span>
                  <input ref={fileRef} type="file" accept="image/*" onChange={upload} />
                </label>
                {s.logo && (
                  <>
                    <div className="thumb"><img src={s.logo} alt="Logo preview" /></div>
                    <Slide label="Logo size" unit="%" min={10} max={45} value={Math.round(s.logoSize * 100)} onChange={(val) => set("logoSize", val / 100)} />
                    <button className="plain" onClick={() => { set("logo", ""); if (fileRef.current) fileRef.current.value = ""; }}>Remove logo</button>
                  </>
                )}
                <p className="hint">Logos cover part of the code, so error correction switches to H automatically.</p>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* =========================================================
   SMALL COMPONENTS
   ========================================================= */

function Seg<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void;
}) {
  const i = Math.max(0, options.findIndex((o) => o.v === value));
  return (
    <div className="seg" role="radiogroup" aria-label={label} style={vars({ "--n": options.length, "--i": i })}>
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, ph, secret }: { label: string; value: string; onChange: (v: string) => void; ph?: string; secret?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="inwrap">
        <input type={secret && !show ? "password" : "text"} value={value} placeholder={ph} onChange={(e) => onChange(e.target.value)} />
        {secret && <button type="button" onClick={() => setShow((x) => !x)}>{show ? "Hide" : "Show"}</button>}
        {!secret && value && <button type="button" aria-label="Clear" onClick={() => onChange("")}>✕</button>}
      </div>
    </label>
  );
}

function DotGlyph({ k }: { k: Dot }) {
  return (
    <span className="glyph" style={vars({ "--r": DR[k] })}>
      {Array.from({ length: 9 }, (_, i) => <i key={i} style={vars({ "--k": (i % 3) + Math.floor(i / 3) })} />)}
    </span>
  );
}

function Tiles<T extends string>({ label, value, options, cols, onChange, onPreview, glyph, labelOf }: {
  label: string; value: T; options: T[]; cols: number; onChange: (v: T) => void; onPreview: (v: T | null) => void;
  glyph: (k: T) => ReactNode; labelOf?: (k: T) => string;
}) {
  return (
    <div className="tiles">
      <span className="tl">{label}</span>
      <div className="tgrid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} onMouseLeave={() => onPreview(null)}>
        {options.map((o, i) => (
          <button key={o} type="button" className={value === o ? "on" : ""} aria-pressed={value === o} style={vars({ "--n": i })}
            onClick={() => { onChange(o); onPreview(null); }} onMouseEnter={() => onPreview(o)} onFocus={() => onPreview(o)} onBlur={() => onPreview(null)}>
            {glyph(o)}<span>{labelOf ? labelOf(o) : pretty(o)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="swatch"><span>{label}</span><input type="color" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function Slide({ label, unit, value, min, max, step = 1, onChange }: { label: string; unit: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="slide">
      <span>{label}<em>{value}{unit}</em></span>
      <input type="range" min={min} max={max} step={step} value={value} style={vars({ "--pct": `${((value - min) / (max - min)) * 100}%` })} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}