import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import QRCodeStyling from "qr-code-styling";
import { buildPayload, validate, emptyFields, type QRType, type Fields } from "./utils/payload";
import "./App.css";

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

const ICONS: Record<QRType, ReactNode> = {
  url: <path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" />,
  text: <path d="M4 6h16M4 12h16M4 18h10" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />,
  wifi: <><path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0" /><circle cx="12" cy="19" r="1" /></>,
};
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
const DOTS: Dot[] = ["square", "dots", "rounded", "extra-rounded", "classy", "classy-rounded"];
const CORNERS: Corner[] = ["square", "dot", "extra-rounded"];
const pretty = (x: string) => x.replace("-", " ").replace(/^./, (c) => c.toUpperCase());

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

export default function App() {
  const [type, setType] = useState<QRType>("url");
  const [fields, setFields] = useState<Fields>({ ...emptyFields, url: "https://example.com" });
  const [s, setS] = useState<S>(DEFAULTS);
  const [preset, setPreset] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("content");
  const [touched, setTouched] = useState(false);
  const [fmt, setFmt] = useState<Fmt>("png");
  const [note, setNote] = useState("");
  const [recent, setRecent] = useState<Recent[]>(() => {
    try {
      const l = JSON.parse(localStorage.getItem("recentQRs") || "[]");
      return Array.isArray(l) ? l.filter((r) => r && r.s && r.data && r.type) : [];
    } catch { return []; }
  });

  const host = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qr = useRef<QRCodeStyling | null>(null);
  if (!qr.current) qr.current = new QRCodeStyling({ type: "canvas", data: " ", width: 400, height: 400 });

  const error = validate(type, fields);
  const payload = useMemo(() => (error ? "" : buildPayload(type, fields)), [type, fields, error]);

  const tones = s.grad ? [s.g1, s.g2] : [s.fg];
  const contrast = Math.min(...tones.map((c) => contrastOf(c, s.bg)));
  const warns: string[] = [];
  if (contrast < 4) warns.push(`Low contrast (${contrast.toFixed(1)}:1)`);
  if (tones.some((c) => lum(c) > lum(s.bg))) warns.push("Light-on-dark fails in some scanners");
  if (s.size < 200) warns.push("Very small size");
  if (s.margin < 4) warns.push("Margin too small");
  if (payload.length > 300 && s.size < 300) warns.push("Lots of data for this size");
  if (s.logo && s.ecc !== "H") warns.push("Use H error correction with a logo");
  if (s.logo && s.logoSize > 0.35) warns.push("Logo is very large");

  useEffect(() => {
    const el = host.current;
    if (el && qr.current) { el.innerHTML = ""; qr.current.append(el); }
    return () => { if (el) el.innerHTML = ""; };
  }, []);

  useEffect(() => {
    if (!payload || !qr.current) return;
    const fill = {
      color: s.fg,
      gradient: s.grad
        ? { type: "linear" as const, rotation: Math.PI / 4, colorStops: [{ offset: 0, color: s.g1 }, { offset: 1, color: s.g2 }] }
        : undefined,
    };
    qr.current.update({
      data: payload, width: s.size, height: s.size, margin: s.margin,
      qrOptions: { errorCorrectionLevel: s.ecc },
      dotsOptions: { ...fill, type: s.dot },
      cornersSquareOptions: { ...fill, type: s.corner },
      cornersDotOptions: { ...fill, type: s.corner === "dot" ? "dot" : "square" },
      backgroundOptions: { color: s.bg },
      image: s.logo || undefined,
      imageOptions: { crossOrigin: "anonymous", margin: 4, imageSize: s.logoSize, hideBackgroundDots: true },
    });
  }, [payload, s]);

  const set = <K extends keyof S>(k: K, v: S[K]) => { setS((p) => ({ ...p, [k]: v })); setPreset(null); };
  const setField = (k: keyof Fields, v: string) => setFields((p) => ({ ...p, [k]: v }));
  const flash = (t: string) => { setNote(t); window.setTimeout(() => setNote(""), 1800); };
  const store = (l: Recent[]) => { setRecent(l); localStorage.setItem("recentQRs", JSON.stringify(l)); };

  const download = () => {
    if (!payload || !qr.current) return;
    qr.current.download({ name: `qr-${type}`, extension: fmt });
    const data = type === "wifi" ? payload.replace(/;P:.*;;$/, ";P:;;") : payload; // never keep Wi-Fi passwords
    store([{ id: Date.now(), type, data, s: { ...s, logo: "" }, at: Date.now() }, ...recent.filter((r) => r.data !== data || r.type !== type)].slice(0, 8));
    flash("Saved");
  };
  const copy = async () => { try { await navigator.clipboard.writeText(payload); flash("Copied"); } catch { flash("Blocked"); } };
  const share = async () => {
    if (!payload || !qr.current) return;
    try {
      const blob = await qr.current.getRawData("png");
      if (!blob) return;
      const file = new File([blob as BlobPart], "qr.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else { qr.current.download({ name: "qr", extension: "png" }); flash("Saved instead"); }
    } catch { /* cancelled */ }
  };
  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 1048576) { flash("Under 1 MB only"); e.target.value = ""; return; }
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
    setType(r.type); setFields(f); setS(r.s); setPreset(null); setTouched(r.type === "wifi"); setTab("content");
  };
  const reset = () => { setType("url"); setFields({ ...emptyFields, url: "https://example.com" }); setS(DEFAULTS); setPreset(null); setTouched(false); };

  const simple = SIMPLE[type];

  return (
    <div className="app">
      <header className="bar">
        <div className="brand"><span className="logo" aria-hidden="true"><i /><i /><i /><i /></span><b>QR Studio</b><em>Design, check, download</em></div>
        <button className="plain" onClick={reset}>Reset</button>
      </header>

      <div className="body">
        <nav className="rail" aria-label="QR type">
          {TYPES.map((t) => (
            <button key={t.v} className={type === t.v ? "on" : ""} aria-pressed={type === t.v}
              onClick={() => { setType(t.v); setTouched(false); setTab("content"); }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[t.v]}</svg>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <main className="canvas">
          <div className="stagewrap">
            <div className={`qrcard ${payload ? "" : "stale"}`}>
              <div ref={host} className="qr" />
              {!payload && <p className="fix">Complete the details to update</p>}
            </div>
            <div className="chips">
              <span>{s.size}px</span><span>{s.ecc} correction</span>
              <span className={warns.length ? "bad" : "good"}>{warns.length ? `${warns.length} to check` : `Scans well · ${contrast.toFixed(1)}:1`}</span>
            </div>
            {warns.length > 0 && <ul className="warns">{warns.map((w) => <li key={w}>{w}</li>)}</ul>}
          </div>

          <div className="dock">
            <div className="seg" role="radiogroup" aria-label="Format">
              {(["png", "jpeg", "svg"] as Fmt[]).map((k) => (
                <button key={k} role="radio" aria-checked={fmt === k} className={fmt === k ? "on" : ""} onClick={() => setFmt(k)}>{k.toUpperCase()}</button>
              ))}
            </div>
            <button className="go" disabled={!payload} onClick={download}>{note || `Download ${fmt.toUpperCase()}`}</button>
            <button className="plain" disabled={!payload} onClick={share}>Share</button>
            <button className="plain" disabled={!payload} onClick={copy}>Copy</button>
          </div>
        </main>

        <aside className="inspector">
          <div className="itabs" role="tablist">
            {(["content", "style", "logo"] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{pretty(t)}</button>
            ))}
          </div>

          <div className="ibody" key={tab + type}>
            {tab === "content" && (
              <>
                <div className="stack" onBlur={() => setTouched(true)}>
                  {simple && <Field label={simple.label} ph={simple.ph} value={fields[simple.key]} onChange={(v) => setField(simple.key, v)} />}
                  {type === "wifi" && (
                    <>
                      <Field label="Network name" ph="My Wi-Fi" value={fields.ssid} onChange={(v) => setField("ssid", v)} />
                      <div className="seg" role="radiogroup" aria-label="Security">
                        {(["WPA", "WEP", "nopass"] as const).map((k) => (
                          <button key={k} role="radio" aria-checked={fields.security === k} className={fields.security === k ? "on" : ""} onClick={() => setField("security", k)}>{k === "nopass" ? "Open" : k}</button>
                        ))}
                      </div>
                      {fields.security !== "nopass" && <Field label="Password" ph="Wi-Fi password" secret value={fields.password} onChange={(v) => setField("password", v)} />}
                    </>
                  )}
                  {touched && error && <p className="err" role="alert">{error}</p>}
                </div>

                {recent.length > 0 && (
                  <>
                    <div className="rhead"><h3>Recent</h3><button className="plain sm" onClick={() => store([])}>Clear</button></div>
                    <div className="rlist">
                      {recent.map((r) => (
                        <button key={r.id} className="rrow" onClick={() => reuse(r)}>
                          <i style={{ background: r.s.grad ? `linear-gradient(135deg, ${r.s.g1}, ${r.s.g2})` : r.s.fg }} />
                          <span><b>{r.type.toUpperCase()}</b>{r.data}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {tab === "style" && (
              <>
                <h3>Presets</h3>
                <div className="presets">
                  {PRESETS.map((p) => (
                    <button key={p.name} className={preset === p.name ? "on" : ""} onClick={() => { setS((o) => ({ ...o, ...p.s })); setPreset(p.name); }}>
                      <i style={{ background: p.s.grad ? `linear-gradient(135deg, ${p.s.g1}, ${p.s.g2})` : p.s.fg }} />{p.name}
                    </button>
                  ))}
                </div>
                <div className="grid2">
                  <Pick label="Dots" value={s.dot} options={DOTS} onChange={(v) => set("dot", v)} />
                  <Pick label="Corners" value={s.corner} options={CORNERS} onChange={(v) => set("corner", v)} />
                  <Pick label="Error correction" value={s.ecc} options={["L", "M", "Q", "H"] as ECC[]} onChange={(v) => set("ecc", v)} raw />
                  <label className="toggle"><span>Gradient</span><input type="checkbox" checked={s.grad} onChange={(e) => set("grad", e.target.checked)} /></label>
                  {s.grad ? (
                    <><Swatch label="From" value={s.g1} onChange={(v) => set("g1", v)} /><Swatch label="To" value={s.g2} onChange={(v) => set("g2", v)} /></>
                  ) : <Swatch label="Foreground" value={s.fg} onChange={(v) => set("fg", v)} />}
                  <Swatch label="Background" value={s.bg} onChange={(v) => set("bg", v)} />
                </div>
                <Slide label="Size" unit="px" min={150} max={600} step={10} value={s.size} onChange={(v) => set("size", v)} />
                <Slide label="Margin" unit="px" min={0} max={40} value={s.margin} onChange={(v) => set("margin", v)} />
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
                    <Slide label="Logo size" unit="%" min={10} max={45} value={Math.round(s.logoSize * 100)} onChange={(v) => set("logoSize", v / 100)} />
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
function Pick<T extends string>({ label, value, options, onChange, raw }: { label: string; value: T; options: T[]; onChange: (v: T) => void; raw?: boolean }) {
  return (
    <label className="pick"><span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>{options.map((o) => <option key={o} value={o}>{raw ? o : pretty(o)}</option>)}</select>
    </label>
  );
}
function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="swatch"><span>{label}</span><input type="color" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
function Slide({ label, unit, value, min, max, step = 1, onChange }: { label: string; unit: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="slide"><span>{label}<em>{value}{unit}</em></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}