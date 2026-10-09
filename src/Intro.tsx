import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./intro.css";

/* ---------- helpers ---------- */
const vars = (o: Record<string, string | number>) => o as CSSProperties;
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- QR cells + dissolve tiles (dx/dy/dz are unitless now: CSS scales them by --e) ---------- */
const QN = 21;
const QR_CELLS = (() => {
  const out: { on: boolean; eye: boolean; r: number; dx: number; dy: number; dz: number }[] = [];
  for (let i = 0; i < QN * QN; i++) {
    const r = Math.floor(i / QN), c = i % QN;
    const inF = (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
    let on = false, eye = false;
    if (inF) {
      const rr = r > 13 ? r - 14 : r, cc = c > 13 ? c - 14 : c;
      const core = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
      on = rr === 0 || rr === 6 || cc === 0 || cc === 6 || core; eye = core;
    } else {
      const sep = (r < 8 && c < 8) || (r < 8 && c > 12) || (r > 12 && c < 8);
      const h = Math.imul(i + 11, 73856093) ^ Math.imul(i * i + 5, 19349663);
      on = !sep && ((h >>> 4) % 9) < 4;
    }
    const h2 = Math.imul(i + 3, 83492791) ^ (i << 7);
    out.push({ on, eye, r, dz: 120 + ((h2 >>> 3) % 320), dx: ((h2 >>> 7) % 260) - 130, dy: ((h2 >>> 11) % 260) - 130 });
  }
  return out;
})();

const COLS = 16, ROWS = 10;
const DISS = Array.from({ length: COLS * ROWS }, (_, i) => ({
  cx: ((i % COLS) + 0.5) / COLS,
  cy: (Math.floor(i / COLS) + 0.5) / ROWS,
  j: ((Math.imul(i + 1, 2654435761) >>> 8) % 100) / 100,
}));

/* ---------- scroll story ---------- */
interface Pose { x: number; y: number; z: number; rx: number; ry: number; rz: number; s: number }
// where the card rests at each frame (x/y in vmin, z in px, angles in deg)
const POSES: Pose[] = [
  { x: 0, y: 0, z: 0, rx: 8, ry: -16, rz: -2, s: 1 },       // intro
  { x: -4, y: 0, z: 40, rx: 16, ry: -38, rz: -6, s: 1.04 },  // style
  { x: 0, y: 0, z: 90, rx: 0, ry: 0, rz: 0, s: 1.1 },        // verify: faces the camera
  { x: 5, y: -2, z: 20, rx: 18, ry: 34, rz: 5, s: .94 },     // export: formats fan out behind
  { x: 0, y: 0, z: 190, rx: 4, ry: -8, rz: 0, s: 1.3 },      // start: pushes toward you
];
const N = POSES.length;
const DUST = Array.from({ length: 30 }, (_, i) => {
  const h = Math.imul(i + 7, 2654435761) >>> 0;
  return { x: h % 100, y: (h >>> 8) % 100, s: 4 + ((h >>> 16) % 9), z: 0.2 + ((h >>> 20) % 80) / 100, d: ((h >>> 4) % 60) / 10, hot: i % 7 === 0 };
});
const TICK = ["Link", "Text", "Email", "Phone", "Wi-Fi", "Gradients", "Logos", "PNG", "JPG", "SVG", "Dark mode", "Ctrl S"];
const LABELS = ["Intro", "Style", "Brand", "Export", "Start"];
const STORY = [
  { tag: "Style", h: "Shape every module.", p: "Six dot styles, three corner styles and gradients. Hover any option to preview it on the live code.",
    meta: [["6", "dot styles"], ["3", "corner styles"], ["Any", "colour"]],
    pills: ["Square", "Dots", "Rounded", "Extra rounded", "Classy", "Classy rounded"] },
  { tag: "Brand", h: "Put your logo in the middle.", p: "Drop in a PNG, JPG or SVG. Error correction switches to H on its own so the code keeps working.",
    meta: [["H", "auto error fix"], ["1 MB", "max image"], ["10–45%", "logo size"]],
    pills: ["Upload a logo", "Resize it", "Remove it any time"] },
  { tag: "Export", h: "PNG, JPG or SVG.", p: "Vector for print, raster for screens. Press Ctrl or ⌘ + S any time, and recent downloads stay one click away.",
    meta: [["3", "formats"], ["5", "recent saves"], ["Ctrl S", "to save"]],
    pills: ["PNG", "JPG", "SVG", "Share", "Copy data"] },
];

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export function Intro({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const frames = useRef<(HTMLDivElement | null)[]>([]);
  const going = useRef(false);
  const timers = useRef<number[]>([]);
  const tgt = useRef(0), cur = useRef(0), raf = useRef(0), prog = useRef(0);
  const [leaving, setLeaving] = useState(false);
  const [ready, setReady] = useState(false); // unlocks once the last frame is reached
  const readyRef = useRef(false);
  const btn2 = useRef<HTMLButtonElement>(null);
  const [origin, setOrigin] = useState({ x: 0.3, y: 0.7 });

  /* push scroll progress (0..1) into CSS variables: one write per frame, no React renders */
  const apply = (p: number) => {
    const el = root.current;
    if (!el) return;
    const f = p * (N - 1), i = Math.min(N - 2, Math.floor(f)), t = f - i;
    const tt = smooth(clamp((t - 0.18) / 0.64)); // each frame dwells before it moves on
    const a = POSES[i], b = POSES[i + 1];
    const L = (k: keyof Pose) => a[k] + (b[k] - a[k]) * tt;
    const st = el.style;
    st.setProperty("--cx", `${L("x")}vmin`); st.setProperty("--cy", `${L("y")}vmin`); st.setProperty("--cz", `${L("z")}px`);
    st.setProperty("--crx", `${L("rx")}deg`); st.setProperty("--cry", `${L("ry")}deg`); st.setProperty("--crz", `${L("rz")}deg`);
    st.setProperty("--cs", String(L("s")));
    st.setProperty("--e", reduced() ? "0" : String(Math.pow(Math.sin(Math.PI * tt), 1.4))); // modules burst apart between frames
    st.setProperty("--fan", String(clamp(1 - Math.abs(f - 3) / 0.7)));
    st.setProperty("--cue", String(clamp(1 - p * 12)));
    st.setProperty("--p", String(p));
    el.dataset.f = String(Math.round(f));
    frames.current.forEach((n, k) => {
      if (!n) return;
      const d = f - k, o = clamp(1 - (Math.abs(d) - 0.12) / 0.42);
      n.style.opacity = String(o);
      n.style.transform = `translate3d(0, ${d * -44}px, ${-Math.abs(d) * 120}px)`;
      n.style.filter = o < 1 ? `blur(${(1 - o) * 8}px)` : "none";
      n.style.visibility = o < 0.02 ? "hidden" : "visible";
    });
  };

  const loop = () => {
    cur.current += (tgt.current - cur.current) * (reduced() ? 1 : 0.1); // damped follow = the "weight"
    if (Math.abs(tgt.current - cur.current) < 0.0004) cur.current = tgt.current;
    prog.current = cur.current;
    apply(cur.current);
    if (!readyRef.current && cur.current > 0.985) { readyRef.current = true; setReady(true); } // damped scroll passes every frame on the way
    raf.current = cur.current === tgt.current ? 0 : requestAnimationFrame(loop);
  };
  const onScroll = () => {
    const s = scroller.current;
    if (!s) return;
    const max = s.scrollHeight - s.clientHeight;
    tgt.current = max > 0 ? s.scrollTop / max : 0;
    if (!raf.current) raf.current = requestAnimationFrame(loop);
  };
  const goTo = (k: number) => {
    const s = scroller.current;
    if (s) s.scrollTo({ top: (k / (N - 1)) * (s.scrollHeight - s.clientHeight), behavior: reduced() ? "auto" : "smooth" });
  };
  // content layers ignore the pointer so wheel/touch reach the scroller; forward wheel from the few that don't
  const onWheel = (e: React.WheelEvent) => {
    if (!(e.target as HTMLElement).closest(".i-scroll") && scroller.current) scroller.current.scrollTop += e.deltaY;
  };

  const enter = (from?: HTMLElement | null) => {
    if (going.current || !readyRef.current) return;
    going.current = true;
    const r = (from ?? btn2.current)?.getBoundingClientRect();
    if (r) setOrigin({ x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight });
    setLeaving(true);
    timers.current = [window.setTimeout(onReveal, 450), window.setTimeout(onDone, 2000)];
  };

  useEffect(() => {
    apply(0);
    scroller.current?.focus({ preventScroll: true }); // arrows / PgDn / Space scroll the story
    const key = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); enter(); } };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      timers.current.forEach((id) => window.clearTimeout(id));
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(liftRaf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ptr = useRef({ x: -9999, y: -9999 });
  const liftRaf = useRef(0);
  const lift = () => {
    liftRaf.current = 0;
    const g = root.current?.querySelector<HTMLElement>(".qgrid");
    if (!g || going.current) return;
    const r = g.getBoundingClientRect(), cw = r.width / QN, { x, y } = ptr.current;
    for (let i = 0; i < g.children.length; i++) {
      if (!QR_CELLS[i].on) continue;
      const d = Math.hypot(r.left + ((i % QN) + 0.5) * cw - x, r.top + (Math.floor(i / QN) + 0.5) * cw - y) / (cw * 5);
      (g.children[i] as HTMLElement).style.setProperty("--lift", d < 1 ? ((1 - d) * (1 - d)).toFixed(3) : "0");
    }
  };
  const aim = (x: number, y: number) => { ptr.current = { x, y }; if (!liftRaf.current) liftRaf.current = requestAnimationFrame(lift); };

  const move = (e: React.PointerEvent) => {
    const el = root.current;
    if (!el) return;
    aim(e.clientX, e.clientY);
    const x = e.clientX / window.innerWidth, y = e.clientY / window.innerHeight;
    el.style.setProperty("--px", String((x - 0.5) * 2));
    el.style.setProperty("--py", String((y - 0.5) * 2));
    el.style.setProperty("--mx", `${e.clientX}px`);
    el.style.setProperty("--my", `${e.clientY}px`);
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
  };
  const magnet = (e: React.PointerEvent<HTMLButtonElement>) => {
    const b = e.currentTarget, r = b.getBoundingClientRect();
    b.style.setProperty("--bx", `${(e.clientX - (r.left + r.width / 2)) * 0.18}px`);
    b.style.setProperty("--by", `${(e.clientY - (r.top + r.height / 2)) * 0.28}px`);
  };
  const unmagnet = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.style.setProperty("--bx", "0px");
    e.currentTarget.style.setProperty("--by", "0px");
  };
  const cta = (ref?: React.Ref<HTMLButtonElement>) => (
    <button ref={ref} className="i-btn" disabled={!ready} onPointerMove={magnet} onPointerLeave={unmagnet} onClick={(e) => { e.stopPropagation(); enter(e.currentTarget); }}>
      <span>Enter studio</span><Arrow />
    </button>
  );

  return (
    <div ref={root} data-f="0" className={`intro ${leaving ? "leaving" : ""}`} onPointerMove={move} onPointerLeave={() => aim(-9999, -9999)} onWheel={onWheel}>
      <div className="i-cells" aria-hidden="true">
        {DISS.map((c, i) => {
          const d = Math.hypot((c.cx - origin.x) * 1.6, c.cy - origin.y) / 1.9;
          return <i key={i} style={vars({ "--dl": `${(d * 0.7 + c.j * 0.12).toFixed(3)}s` })} />;
        })}
      </div>
      <div className="i-spot" aria-hidden="true" />
      <div className="i-grain" aria-hidden="true" />
      <div className="i-dust" aria-hidden="true">
        {DUST.map((d, i) => <i key={i} className={d.hot ? "hot" : ""} style={vars({ "--x": d.x, "--y": d.y, "--s": d.s, "--z": d.z, "--d": `${d.d}s` })} />)}
      </div>
      <div className="i-prog" aria-hidden="true" />

      {/* invisible scroll proxy: its scroll position drives the whole scene */}
      <div ref={scroller} className="i-scroll" tabIndex={0} aria-label="Product tour. Scroll to explore." onScroll={onScroll}>
        <div className="i-track" />
      </div>

      <header className="i-top">
        <span className="i-logo"><i />modul</span>
        <span className="i-ver">QR studio · v2</span>
      </header>

      <nav className="i-rail" aria-label="Tour">
        {LABELS.map((l, k) => <button key={l} aria-label={l} title={l} onClick={(e) => { e.stopPropagation(); goTo(k); }} />)}
      </nav>

      <div className="i-main">
        <div className="i-copy">
          <div className="i-frame" ref={(n) => { frames.current[0] = n; }}>
            <span className="i-tag" style={vars({ "--n": 0 })}><i />Free · runs in your browser</span>
            <h1 style={vars({ "--n": 1 })} aria-label="QR codes, engineered to scan.">
              {[["QR"], ["codes,"], null, ["engineered", "em"], ["to"], ["scan."]].map((w, k) =>
                w ? <span key={k} className="w" aria-hidden="true"><i style={vars({ "--w": k })}>{w[1] ? <em>{w[0]}</em> : w[0]}</i>{" "}</span> : <br key={k} />)}
            </h1>
            <p style={vars({ "--n": 2 })}>Pick a type, style every module, add your logo and export it in one click.</p>
            <div className="i-cta" style={vars({ "--n": 3 })}>
              <button ref={btn} className="i-btn" onPointerMove={magnet} onPointerLeave={unmagnet} onClick={(e) => { e.stopPropagation(); goTo(1); }}>
                <span>Start the tour</span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
              </button>
              <span className="i-anywhere">5 short steps · scroll or press ↓</span>
            </div>
            <ul className="i-meta" style={vars({ "--n": 4 })}>
              <li><b>5</b>content types</li>
              <li><b>3</b>export formats</li>
              <li><b>Live</b>preview</li>
            </ul>
          </div>

          {STORY.map((s, k) => (
            <div className="i-frame" key={s.tag} ref={(n) => { frames.current[k + 1] = n; }}>
              <span className="i-tag"><i />{s.tag}</span>
              <h2>{s.h}</h2>
              <p>{s.p}</p>
              <ul className="i-pills">{s.pills.map((x) => <li key={x}>{x}</li>)}</ul>
              <ul className="i-meta">{s.meta.map(([b, t]) => <li key={t}><b>{b}</b>{t}</li>)}</ul>
            </div>
          ))}

          <div className="i-frame" ref={(n) => { frames.current[4] = n; }}>
            <span className="i-tag"><i />Start</span>
            <h2>Open the studio.</h2>
            <p>Begin with a link, a message, an email, a phone number or your Wi-Fi. Everything is built in your browser.</p>
            <div className="i-cta">{cta(btn2)}{ready && <kbd>↵ Enter</kbd>}</div>
          </div>
        </div>

        <div className="i-stage" aria-hidden="true">
          <div className="i-zoom">
            <div className="i-card">
              <div className="plate p-glow" />
              {["PNG", "JPG", "SVG"].map((t, k) => <div key={t} className="plate fmtp" style={vars({ "--k": k + 1 })}>{t}</div>)}
              <div className="plate p-qr">
                <div className="qgrid">
                  {QR_CELLS.map((c, i) => (
                    <i key={i} className={`${c.on ? "on" : ""} ${c.eye ? "eye" : ""}`}
                      style={vars({ "--r": c.r, "--c": i % QN, "--dx": c.dx, "--dy": c.dy, "--dz": c.dz })} />
                  ))}
                </div>
                <b className="qbeam" />
                <span className="qc tl" /><span className="qc tr" /><span className="qc bl" /><span className="qc br" />
              </div>
              <div className="plate p-glass" />

              <div className="chip c1"><small>Colour</small><span className="cdots"><i /><i /><i /></span></div>
              <div className="chip c2"><small>Error fix</small><b>H · 30%</b></div>
              <div className="chip c3"><i /> Saved · PNG</div>
            </div>
          </div>
        </div>
      </div>

      <div className="i-ticker" aria-hidden="true">
        <div>{[0, 1].map((k) => <span key={k}>{TICK.map((x) => <b key={x}>{x}</b>)}</span>)}</div>
      </div>
      <span className="i-cue" aria-hidden="true">Scroll</span>
    </div>
  );
}