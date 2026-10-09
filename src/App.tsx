import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import QRCodeStyling from "qr-code-styling";
import Lenis from "lenis";
import { buildPayload, validate, emptyFields, type QRType, type Fields } from "./utils/payload";
import { drawScene } from "./scene";
import "./App.css";
import "./polish.css";
import "./theme.css";
import ScrollStory from "./ScrollStory";

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
interface Recent { id: number; type: QRType; data: string; s: S; at: number; f?: Fmt }

const DEFAULTS: S = {
  size: 400, margin: 12, fg: "#0b0d16", bg: "#f6f3ec", ecc: "M", dot: "rounded", corner: "extra-rounded",
  grad: false, g1: "#1f3bff", g2: "#9333ea", logo: "", logoSize: 0.3,
};

const PRESETS: { name: string; s: Partial<S> }[] = [
  { name: "Classic", s: { fg: "#000000", bg: "#f6f3ec", grad: false, dot: "square", corner: "square" } },
  { name: "Ink", s: { fg: "#111729", bg: "#edeade", grad: false, dot: "rounded", corner: "extra-rounded" } },
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
const FORMATS: { v: Fmt; label: string }[] = [
  { v: "png", label: "PNG" }, { v: "jpeg", label: "JPG" }, { v: "svg", label: "SVG" },
];
const SECURITY: { v: Fields["security"]; label: string }[] = [
  { v: "WPA", label: "WPA" }, { v: "WEP", label: "WEP" }, { v: "nopass", label: "Open" },
];
const TABS: Tab[] = ["content", "style", "logo"];
const DOTS: Dot[] = ["square", "dots", "rounded", "extra-rounded", "classy", "classy-rounded"];
const CORNERS: Corner[] = ["square", "dot", "extra-rounded"];
const DR: Record<Dot, string> = { square: "0", dots: "50%", rounded: "32%", "extra-rounded": "44%", classy: "0 65% 0 65%", "classy-rounded": "38% 72% 38% 72%" };
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
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a1 1 0 012-2h9" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  reset: <path d="M4 12a8 8 0 108-8H8m0 0l3-3M8 4l3 3" />,
  moon: <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  scan: <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2M4 12h16" />,
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

// short, human label for a saved code
const describe = (r: Recent) => {
  if (r.type === "email") return r.data.replace("mailto:", "");
  if (r.type === "phone") return r.data.replace("tel:", "");
  if (r.type === "wifi") return r.data.match(/;S:(.*?);P:/)?.[1] || "Wi-Fi network";
  if (r.type === "url") {
    try { const u = new URL(r.data); return u.hostname.replace(/^www\./, "") + (u.pathname === "/" ? "" : u.pathname); } catch { return r.data; }
  }
  return r.data;
};

const hostOf = (u: string) => {
  try { return new URL(/^[a-z]+:/i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, ""); } catch { return u; }
};

// one place that turns a design into QR options (used by the preview AND "download again")
function optionsFor(v: S, data: string) {
  const fill = {
    color: v.fg,
    gradient: v.grad
      ? { type: "linear" as const, rotation: Math.PI / 4, colorStops: [{ offset: 0, color: v.g1 }, { offset: 1, color: v.g2 }] }
      : undefined,
  };
  return {
    data, width: v.size, height: v.size, margin: v.margin,
    qrOptions: { errorCorrectionLevel: v.ecc },
    dotsOptions: { ...fill, type: v.dot },
    cornersSquareOptions: { ...fill, type: v.corner },
    cornersDotOptions: { ...fill, type: v.corner === "dot" ? ("dot" as const) : ("square" as const) },
    backgroundOptions: { color: v.bg },
    image: v.logo || undefined,
    imageOptions: { crossOrigin: "anonymous", margin: 4, imageSize: v.logoSize, hideBackgroundDots: true },
  };
}

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

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      {M_GLYPH.map((on, i) => <i key={i} className={on ? "on" : ""} style={vars({ "--d": `${(i % 5) * 0.16}s` })} />)}
    </span>
  );
}

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

const GRADES = [
  { min: 85, name: "Excellent", tone: "good" },
  { min: 70, name: "Good", tone: "good" },
  { min: 50, name: "Fair", tone: "mid" },
  { min: 0, name: "Poor", tone: "bad" },
] as const;

// eases a number toward its target (instant when reduced motion is on)
function useTween(target: number) {
  const [n, setN] = useState(0);
  const cur = useRef(0);
  useEffect(() => {
    const from = cur.current;
    const t0 = performance.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const step = (t: number) => {
      const p = reduce ? 1 : Math.min(1, (t - t0) / 600);
      cur.current = from + (target - from) * (1 - Math.pow(1 - p, 3));
      setN(Math.round(cur.current));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return n;
}

/* =========================================================
   APP
   ========================================================= */

function Studio() {
  /* ---------- state ---------- */
  const [type, setType] = useState<QRType>("url");
  const [fields, setFields] = useState<Fields>({ ...emptyFields, url: "https://example.com" });
  const [s, setS] = useState<S>(DEFAULTS);
  const [preset, setPreset] = useState<string | null>(null);
  const [hover, setHover] = useState<Partial<S> | null>(null);
  const [modules, setModules] = useState(0);
  const [sizes, setSizes] = useState<Partial<Record<Fmt, string>>>({});
  const [tab, setTab] = useState<Tab>("content");
  const [touched, setTouched] = useState(false);
  const [fmt, setFmt] = useState<Fmt>("png");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [dlPhase, setDlPhase] = useState<"idle" | "busy" | "done">("idle");
  const [dlInfo, setDlInfo] = useState<{ size: string } | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  const [recBump, setRecBump] = useState(0);
  const [recPulse, setRecPulse] = useState(false);
  const [undo, setUndo] = useState<Recent[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("qr-theme");
      if (saved) return saved === "dark";
    } catch { /* storage blocked */ }
    // dark by default: the story's finale is dark, so the iris must not reveal white
    return true;
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
  const pulseTimer = useRef(0);
  const undoTimer = useRef(0);
  const canvasRef = useRef<HTMLElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const eyeRef = useRef<HTMLSpanElement>(null);
  const downloadRef = useRef<() => void>(() => {});
  const dlTimers = useRef<number[]>([]);
  const noteTimer = useRef(0);
  const copyTimer = useRef(0);
  const qr = useRef<QRCodeStyling | null>(null);
  if (!qr.current) qr.current = new QRCodeStyling({ type: "canvas", data: " ", width: 400, height: 400 });
  const appRef = useRef<HTMLDivElement>(null);
  const bgCvRef = useRef<HTMLCanvasElement>(null);
  const [entered, setEntered] = useState(true);

  /* panels stagger in when the story's iris reveals the studio */
  useEffect(() => {
    const el = appRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setEntered(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setEntered(true);
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* 3-D blocks background: the same scene.ts renderer locked at the finale frame */
  useEffect(() => {
    const canvas = bgCvRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dpr = 1, w = 0, h = 0, raf = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      mouse.x += (mouse.tx - mouse.x) * (1 - Math.exp(-dt * 4));
      mouse.y += (mouse.ty - mouse.y) * (1 - Math.exp(-dt * 4));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // p = 0.995 → the flat, close-up grid of fully-assembled cubes
      drawScene(ctx, w, h, reduce ? 0.995 : 0.995, now / 1000, mouse);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("pointermove", onMove); };
  }, []);

  /* ---------- derived ---------- */
  const v = useMemo<S>(() => (hover ? { ...s, ...hover } : s), [s, hover]); // what the preview shows
  const previewing = !!hover;
  const error = validate(type, fields);
  const payload = useMemo(() => (error ? "" : buildPayload(type, fields)), [type, fields, error]);
  const simple = SIMPLE[type];

  const tones = v.grad ? [v.g1, v.g2] : [v.fg];
  // the studio's accent follows the film: orange → cobalt → ember
  const hue = v.grad ? (v.g1 === "#1f3bff" ? 226 : 14) : 24;
  const contrast = Math.min(...tones.map((c) => contrastOf(c, v.bg)));
  const warns: string[] = [];
  if (contrast < 4) warns.push(`Low contrast (${contrast.toFixed(1)}:1)`);
  if (tones.some((c) => lum(c) > lum(v.bg))) warns.push("Light-on-dark fails in some scanners");
  if (v.size < 200) warns.push("Very small size");
  if (v.margin < 4) warns.push("Margin too small");
  if (payload.length > 300 && v.size < 300) warns.push("Lots of data for this size");
  if (v.logo && v.ecc !== "H") warns.push("Use H error correction with a logo");
  if (v.logo && v.logoSize > 0.35) warns.push("Logo is very large");

  /* ---------- scan readability ---------- */
  const version = modules ? Math.max(1, Math.round((modules - 17) / 4)) : 0;
  const cm = (v.size / 300) * 2.54; // printed at 300 dpi
  const density = version <= 5 ? 0 : version <= 12 ? 1 : 2;
  const inverted = tones.some((c) => lum(c) > lum(v.bg));
  const factors = [
    { k: "Contrast", w: 0.35, note: `${contrast.toFixed(1)}:1`,
      s: contrast >= 7 ? 100 : contrast >= 4 ? 80 + ((contrast - 4) / 3) * 20 : clamp(((contrast - 1) / 3) * 80) },
    { k: "Size", w: 0.2, note: `${cm.toFixed(1)} cm`, s: clamp((cm / 3) * 100) },
    { k: "Margin", w: 0.15, note: `${v.margin}px`, s: clamp((v.margin / 10) * 100) },
    { k: "Density", w: 0.15, note: ["Low", "Medium", "High"][density], s: [100, 70, 40][density] },
    { k: "Error fix", w: 0.15, note: v.ecc, s: v.logo && v.ecc !== "H" ? 30 : { L: 50, M: 75, Q: 90, H: 100 }[v.ecc] },
  ];
  const score = payload
    ? Math.round(clamp(factors.reduce((a, f) => a + f.s * f.w, 0) - (inverted ? 25 : 0) - (v.logo && v.logoSize > 0.35 ? 10 : 0)))
    : 0;
  const grade = GRADES.find((g) => score >= g.min) ?? GRADES[3];

  /* ---------- scan test: runs only when asked, and always runs to the end ---------- */
  const SCAN_MS = 1400;
  const [phase, setPhase] = useState<"rest" | "scanning" | "settle">("rest");
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ k: "ok" | "warn"; n: number } | null>(null);
  const scanning = useRef(false);
  const scanTimers = useRef<number[]>([]);
  const scoreRef = useRef(0);
  scoreRef.current = score;
  const scanOn = phase === "scanning";
  const shown = useTween(payload && !scanOn ? score : 0);

  const kickScan = () => {
    if (!payload || scanning.current) return; // a scan in progress is never cut short or restarted
    scanning.current = true;
    setResult(null);
    setPhase("scanning");
    setRun((r) => r + 1);
    scanTimers.current = [
      window.setTimeout(() => {
        scanning.current = false;
        setPhase("settle");
        setResult({ k: scoreRef.current >= 70 ? "ok" : "warn", n: Date.now() });
      }, SCAN_MS),
      window.setTimeout(() => setPhase("rest"), SCAN_MS + 1700),
    ];
  };
  useEffect(() => () => scanTimers.current.forEach((id) => window.clearTimeout(id)), []);

  // clicking a style option runs a full scan on the real QR
  const onInspectorClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".tgrid button, .presets button, .toggle")) kickScan();
  };

  useEffect(() => {
    if (!result) return;
    const id = window.setTimeout(() => setResult(null), 2400);
    return () => window.clearTimeout(id);
  }, [result]);

  /* ---------- QR instance ---------- */
  useEffect(() => {
    const el = host.current;
    if (el && qr.current) { el.innerHTML = ""; qr.current.append(el); }
    return () => { if (el) el.innerHTML = ""; };
  }, []);

  useEffect(() => {
    if (!payload || !qr.current) return;
    qr.current.update(optionsFor(v, payload));
    // module count lets the scan animation size the finder-pattern lock boxes
    const q = (qr.current as unknown as { _qr?: { getModuleCount: () => number } })._qr;
    if (q) setModules(q.getModuleCount());
  }, [payload, v]);

  // file size of each format (debounced, so sliders stay smooth)
  useEffect(() => {
    if (!payload || !qr.current) { setSizes({}); return; }
    let alive = true;
    const id = window.setTimeout(() => {
      FORMATS.forEach(({ v: f }) => {
        qr.current?.getRawData(f).then((b) => {
          if (alive && b) setSizes((p) => ({ ...p, [f]: fmtSize((b as Blob).size) }));
        }).catch(() => { /* optional */ });
      });
    }, 450);
    return () => { alive = false; window.clearTimeout(id); };
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
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setRecOpen(false); recBtnRef.current?.focus(); } };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [recOpen]);

  useEffect(() => {
    if (!recOpen) return;
    const id = requestAnimationFrame(() => recRef.current?.querySelector<HTMLButtonElement>(".rl-main")?.focus());
    return () => cancelAnimationFrame(id);
  }, [recOpen]);

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
  const store = (l: Recent[]) => { setRecent(l); try { localStorage.setItem("recentQRs", JSON.stringify(l)); } catch { /* ignore */ } }

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
    store([{ id: Date.now(), type, data, s: { ...s, logo: "" }, at: Date.now(), f }, ...recent.filter((r) => r.data !== data || r.type !== type)].slice(0, 5));
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
    setType(r.type); setFields(f); setS(r.s); setPreset(null); setTouched(r.type === "wifi"); setTab("content"); setRecOpen(false); if (r.f) setFmt(r.f);
  };

  const reset = () => {
    setType("url"); setFields({ ...emptyFields, url: "https://example.com" });
    setS(DEFAULTS); setPreset(null); setTouched(false);
  };

  /* ---------- recent downloads ---------- */
  const removeRecent = (ids: number[]) => {
    setUndo(recent); // keep the old list so Undo can bring it back
    store(recent.filter((r) => !ids.includes(r.id)));
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), 5000);
  };
  const restoreRecent = () => { if (undo) store(undo); setUndo(null); };
  const clearAll = () => { // first click arms it, second click clears
    if (!confirmClear) { setConfirmClear(true); window.setTimeout(() => setConfirmClear(false), 2500); return; }
    setConfirmClear(false);
    removeRecent(recent.map((r) => r.id));
  };
  const redownload = (r: Recent) => { // saves the stored design again without loading it
    const f = r.f ?? "png";
    new QRCodeStyling({ type: "canvas", ...optionsFor(r.s, r.data) }).download({ name: `qr-${r.type}`, extension: f });
    store([{ ...r, id: Date.now(), at: Date.now() }, ...recent.filter((x) => x.id !== r.id)]);
    flash(`Saved again · ${f.toUpperCase()}`);
  };
  const navRecent = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>(".rl-main"));
    if (!rows.length) return;
    e.preventDefault();
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    rows[(i + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length].focus();
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

  /* ---------- QR details (content tab) ---------- */
  const bytes = payload ? new TextEncoder().encode(payload).length : 0;
  const onScan =
    type === "url" ? `Opens ${hostOf(fields.url)}`
    : type === "email" ? `Starts an email to ${fields.email}`
    : type === "phone" ? `Offers to call ${fields.phone}`
    : type === "wifi" ? `Joins “${fields.ssid}”${fields.security === "nopass" ? " · open network" : ` · ${fields.security}`}`
    : "Shows your text on screen";
  const tip =
    density === 2 ? "Dense code. Print it at 4 cm or larger, or shorten the content."
    : cm < 2 ? "This prints very small. Aim for 2.5 cm or larger."
    : type === "url" && payload.length > 60 ? "Long links make dense codes. A shorter link scans faster."
    : "Looks good. Print at 2.5 cm or larger for reliable scans.";
  const raw = type === "wifi" ? payload.replace(/;P:.*;;$/, ";P:••••••;;") : payload;
  const stats: [string, ReactNode][] = [
    ["Grid", `${modules} × ${modules}`],
    ["Version", `${version} / 40`],
    ["Data", `${payload.length} chars · ${bytes} B`],
    ["Error fix", `${v.ecc} · ${{ L: 7, M: 15, Q: 25, H: 30 }[v.ecc]}%`],
    ["Size", `${v.size}px · ${cm.toFixed(1)} cm`],
    ["Scan from", `≈ ${Math.round(cm * 10)} cm`],
    ["Contrast", `${contrast.toFixed(1)}:1`],
    ["Density", <>{["Low", "Medium", "High"][density]}<span className={`dbar ${["", "mid", "high"][density]}`}>{[0, 1, 2].map((i) => <i key={i} className={i <= density ? "on" : ""} />)}</span></>],
  ];
  const details = payload ? (
    <div className="details">
      <div className="onscan"><Ico k="scan" /><span>When scanned<b>{onScan}</b></span></div>

      <div className="scorecard">
        <div className="sc-left">
          <div className="sc-num"><b>{shown}</b><i>%</i></div>
          <div className="sc-meta"><span>Scan readability</span><em className={`gpill ${grade.tone}`}>{grade.name}</em></div>
        </div>
        <div className="sc-dial" aria-hidden="true">
          <svg viewBox="0 0 120 120" width="108" height="108">
            <circle className="sd-tr" cx="60" cy="60" r="50" />
            {Array.from({ length: 32 }, (_, i) => (
              <line key={i} className={`sd-tick ${((i + 1) / 32) * 100 <= score ? "on" : ""}`}
                style={vars({ "--i": i })}
                x1="60" y1="7" x2="60" y2={i % 8 === 0 ? 15 : 11}
                transform={`rotate(${i * 11.25} 60 60)`} />
            ))}
            <circle className="sd-arc" cx="60" cy="60" r="50" pathLength="100"
              strokeDasharray="100" strokeDashoffset={100 - score} transform="rotate(-90 60 60)" />
            <circle className="sd-needle" cx="60" cy="60" r="3"
              transform={`rotate(${score * 3.6 - 90} 60 60)`} />
          </svg>
        </div>
      </div>
      <ul className="factors">
        {factors.map((f, i) => (
          <li key={f.k} className={f.s >= 70 ? "" : f.s >= 45 ? "mid" : "bad"} style={vars({ "--n": i, "--s": f.s })}>
            <span>{f.k}</span><i className="fbar"><b /></i><em>{f.note}</em>
          </li>
        ))}
      </ul>

      <h3>QR details</h3>
      <dl className="stats">
        {stats.map(([k, val], i) => <div key={k} style={vars({ "--n": i })}><dt>{k}</dt><dd>{val}</dd></div>)}
      </dl>

      <h3>Quick save</h3>
      <div className="fsizes">
        {FORMATS.map((f) => (
          <button key={f.v} type="button" title={`Download ${f.label}`} onClick={() => download(f.v)}>
            <b>{f.label}</b><span>{sizes[f.v] ?? "…"}</span>
          </button>
        ))}
      </div>

      <h3>Raw data</h3>
      <button type="button" className="raw" onClick={copy} title="Click to copy"><code>{raw}</code><Ico k="copy" /></button>

      <p className="tip">{tip}</p>
    </div>
  ) : (
    <p className="hint">QR details appear here once the content is valid.</p>
  );

  return (
    <div ref={appRef} className={`app ${dark ? "dark" : ""} ${entered ? "in" : ""}`} style={vars({ "--hue": hue })}>
      {/* Full-bleed 3-D blocks background — matches ScrollStory canvas pixel-for-pixel */}
      <canvas ref={bgCvRef} className="bg-cv" aria-hidden="true" />
      <div className="bg-vignette" aria-hidden="true" />

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
              <div className="recpop" data-lenis-prevent role="dialog" aria-label="Recent downloads">
                <div className="rhead">
                  <h3>Recent downloads <em>{Math.min(recent.length, 5)}/5</em></h3>
                  {recent.length > 0 && <button className={`linkbtn ${confirmClear ? "warn" : ""}`} onClick={clearAll}>{confirmClear ? "Sure? Click again" : "Clear all"}</button>}
                </div>

                {recent.length === 0 ? (
                  <div className="rempty">
                    <span className="rempty-ico"><Ico k="download" /></span>
                    <b>Nothing here yet</b>
                    <p>Download a code and it lands here, ready to reload or save again.</p>
                  </div>
                ) : (
                  <ul className="rlist" onKeyDown={navRecent}>
                    {recent.slice(0, 5).map((r, i) => (
                      <li key={r.id} style={vars({ "--n": i })}>
                        <button className="rl-main" onClick={() => reuse(r)} title="Load this design into the editor">
                          <i className="rl-dot" style={{ background: r.s.grad ? `linear-gradient(180deg, ${r.s.g1}, ${r.s.g2})` : r.s.fg }} />
                          <span className="rl-body">
                            <span className="rl-top"><span className="rl-type">{r.type}</span><span className="rl-fmt">{(r.f ?? "png").toUpperCase()}</span><small>{ago(r.at)}</small></span>
                            <span className="rl-data">{describe(r)}</span>
                          </span>
                        </button>
                        <span className="rl-acts">
                          <button aria-label="Download again" title={r.type === "wifi" ? "Wi-Fi passwords aren't stored. Load it and re-enter the password." : "Download again"} disabled={r.type === "wifi"} onClick={() => redownload(r)}><Ico k="download" /></button>
                          <button className="del" aria-label="Remove" title="Remove" onClick={() => removeRecent([r.id])}>✕</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {undo && <div className="rundo"><span>Removed {Math.max(1, undo.length - recent.length)}</span><button className="linkbtn" onClick={restoreRecent}>Undo</button></div>}
                {recent.length > 0 && <p className="rfoot">Click a row to load it · <Ico k="download" /> saves it again</p>}
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
            <div className={`qrframe ${scanOn ? "testing" : ""} ${result ? `res-${result.k}` : ""} ${previewing ? "pv" : ""}`} data-size={`${v.size} × ${v.size} px`}>
              <div className={`qrcard ${payload ? "" : "stale"} ${previewing ? "preview" : ""}`} style={{ background: v.bg }}>
                <div ref={host} className="qr" />
                {payload && scanOn && (
                  <div className="scanfx" key={run} aria-hidden="true"><b className="beam" /></div>
                )}
                {!payload && <p className="fix">Complete the details to update</p>}
              </div>

              {payload && (
                <>
                  <span className="call c1"><b>{modules} × {modules}</b>modules</span>
                  <span className="call c2"><b>{cm.toFixed(1)} cm</b>print size</span>
                  <span className="call c3"><b>≈ {Math.round(cm * 10)} cm</b>scan from</span>
                </>
              )}

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

            <div className="vrow">
              <button type="button" disabled={!payload} onClick={kickScan} aria-live="polite"
                style={vars({ "--sc": payload && !scanOn ? score : 0 })}
                className={`verdict ${!payload ? "idle" : scanOn ? "testing" : grade.tone} ${phase === "settle" ? "settle" : ""}`}>
                <span className="sr">{!payload ? "waiting" : scanOn ? "scanning" : `scan readability ${score} percent, ${grade.name}`}</span>
                <span className="vnum" aria-hidden="true">
                  <b>{!payload ? "—" : scanOn ? "··" : shown}</b>{payload && !scanOn && <i>%</i>}
                </span>
                <span className="vmid" aria-hidden="true">
                  <small>Scan readability</small>
                </span>
                <span className={`vgrade ${grade.tone}`} aria-hidden="true">
                  <i className="gdot" />
                  {!payload ? "Waiting" : scanOn ? "Reading" : grade.name}
                </span>
              </button>
              {payload && (
                <span className={`ratio ${contrast >= 4 ? "ok" : "low"}`} title="Contrast between the code and its background. 4:1 or higher scans reliably.">
                  <b>{contrast.toFixed(1)}:1</b>
                  <small>Contrast</small>
                </span>
              )}
            </div>
            {warns.length > 0 && <ul className="warns">{warns.map((w) => <li key={w}>{w}</li>)}</ul>}
          </div>

          {/* ---------- dock ---------- */}
          <div className="dock">
            <Seg label="Format" value={fmt} options={FORMATS} onChange={setFmt} />
            <span className="sep" />

            <button className={`dl ${dlPhase}`} disabled={!payload} onClick={() => download()} title="Download (Ctrl/⌘ + S)">
              <svg className="dl-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {dlPhase === "idle" && <><path className="arrow" d="M12 4v11m0 0l-4-4m4 4l4-4" /><path d="M5 20h14" /></>}
                {dlPhase === "busy" && <><circle className="track" cx="12" cy="12" r="8" /><circle className="ring" cx="12" cy="12" r="8" pathLength="1" /></>}
                {dlPhase === "done" && <path className="ck" d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" />}
              </svg>
              <span key={dlPhase} className="dl-label">
                {dlPhase === "busy" ? "Saving" : dlPhase === "done" ? `Saved${dlInfo?.size ? ` · ${dlInfo.size}` : ""}` : "Download"}
              </span>
            </button>

            <span className="sep" />
            <button className="plain sq" disabled={!payload} onClick={share} aria-label="Share" title="Share"><Ico k="share" /></button>
            <button className={`plain sq ${copied ? "ok" : ""}`} disabled={!payload} onClick={copy} aria-label="Copy QR data" title="Copy QR data"><Ico k={copied ? "check" : "copy"} /></button>
          </div>
        </main>

        {/* ---------- inspector ---------- */}
        <aside className="inspector" data-lenis-prevent onClick={onInspectorClick}>
          <div className="itabs" role="tablist" style={vars({ "--n": TABS.length, "--i": TABS.indexOf(tab) })}>
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{pretty(t)}</button>
            ))}
          </div>

          <div className="ibody" key={tab + type}>
            {tab === "content" && (
              <>
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
              {details}
              </>
            )}

            {tab === "style" && (
              <>
                <h3>Presets</h3>
                <div className="presets">
                  {PRESETS.map((p) => (
                    <button key={p.name} className={preset === p.name ? "on" : ""}
                      onClick={() => { setS((o) => ({ ...o, ...p.s })); setPreset(p.name); setHover(null); }}
                      onMouseEnter={() => setHover(p.s)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.s)} onBlur={() => setHover(null)}>
                      <i style={{ background: p.s.grad ? `linear-gradient(135deg, ${p.s.g1}, ${p.s.g2})` : `linear-gradient(135deg, ${p.s.bg ?? "#fff"} 50%, ${p.s.fg ?? "#000"} 50%)` }} />{p.name}
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
   PAGE: scroll film first, the studio as its final chapter
   ========================================================= */

export default function App() {
  /* inertial scrolling; skipped entirely when reduced motion is requested */
  const [lenis, setLenis] = useState<Lenis | null>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const l = new Lenis({ lerp: 0.09 });
    let id = requestAnimationFrame(function raf(t: number) { l.raf(t); id = requestAnimationFrame(raf); });
    setLenis(l);
    return () => { cancelAnimationFrame(id); l.destroy(); };
  }, []);

  return (
    <>
      <ScrollStory lenis={lenis} />
      <section id="studio" className="studio-section">
        <Studio />
      </section>
    </>
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