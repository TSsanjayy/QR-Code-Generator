import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type Lenis from "lenis";
import { accentHue, drawScene, seg } from "./scene";
import "./ScrollStory.css";

/* =========================================================
   MODUL · scroll film
   An 900vh runway with a pinned canvas. Scroll position → p (0..1) →
   one procedural 3D frame. Chapter copy fades on the same timeline.
   ========================================================= */

const CH: { id: string; a: number; b: number; num: string; label: string }[] = [
  { id: "hero", a: 0, b: 0.075, num: "00", label: "Intro" },
  { id: "gather", a: 0.095, b: 0.265, num: "01", label: "Gather" },
  { id: "depth", a: 0.305, b: 0.455, num: "02", label: "Depth" },
  { id: "style", a: 0.485, b: 0.595, num: "03", label: "Style" },
  { id: "scan", a: 0.645, b: 0.805, num: "04", label: "Scan" },
  { id: "ship", a: 0.825, b: 0.915, num: "05", label: "Export" },
  { id: "cta", a: 0.915, b: 0.975, num: "06", label: "Studio" },
];
const TOTAL_FRAMES = 240;
const vars = (o: Record<string, string | number>) => o as CSSProperties;
const pad = (n: number, l: number) => String(n).padStart(l, "0");
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function ScrollStory({ lenis }: { lenis?: Lenis | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const chRefs = useRef<(HTMLElement | null)[]>([]);
  const railRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pctRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLElement>(null);
  const progRef = useRef<HTMLElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLHeadingElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = wrap.current;
    const canvas = cv.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      // phones gain height when the URL bar hides; cap DPR there so we don't repaint 3x the pixels
      dpr = Math.min(canvas.clientWidth < 820 ? 1.5 : 2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); // catches mobile URL-bar height changes, unlike window resize
    ro.observe(canvas);

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const chapters = CH.map((c, i) => ({ ...c, el: chRefs.current[i] }));
    const studioEl = document.getElementById("studio");
    let p = 0;
    let last = performance.now();
    let raf = 0;
    let activeRail = -1;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const r = root.getBoundingClientRect();
      if (r.bottom < -80) return; // story scrolled past: nothing to paint
      const span = Math.max(1, r.height - window.innerHeight);
      const target = Math.min(1, Math.max(0, -r.top / span));
      p = reduce ? target : p + (target - p) * (1 - Math.exp(-dt * 12));
      if (Math.abs(target - p) < 0.0002) p = target;

      mouse.x += (mouse.tx - mouse.x) * (1 - Math.exp(-dt * 4));
      mouse.y += (mouse.ty - mouse.y) * (1 - Math.exp(-dt * 4));

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const out = drawScene(ctx, w, h, p, now / 1000, mouse);

      /* chapter copy */
      const F = 0.025;
      let cur = 0;
      for (let i = 0; i < chapters.length; i++) {
        const c = chapters[i];
        if (p >= c.a - 0.01) cur = i;
        const el = c.el;
        if (!el) continue;
        const fin = c.a <= 0 ? 1 : seg(p, c.a, c.a + F);
        const fout = 1 - seg(p, c.b - F, c.b);
        const v = fin * fout;
        el.style.opacity = v.toFixed(3);
        el.style.transform = `translate3d(0, ${((1 - fin) * 28 - (1 - fout) * 28).toFixed(1)}px, 0)`;
        el.style.filter = v > 0.99 ? "none" : `blur(${((1 - v) * 6).toFixed(1)}px)`;
        el.style.visibility = v < 0.01 ? "hidden" : "visible";
        el.style.pointerEvents = v > 0.6 ? "auto" : "none";
        // the "01 — GATHER" rule draws itself in behind the label
        el.style.setProperty("--k", fin.toFixed(3));
        // headline, then paragraph, then chips — one after another, not as a block
        const kids = el.querySelectorAll<HTMLElement>("h2,p,.chips,.readout");
        for (let k = 0; k < kids.length; k++) {
          kids[k].style.opacity = seg(p, c.a + k * 0.008, c.a + F + k * 0.008).toFixed(3);
        }
      }
      if (cur !== activeRail) {
        activeRail = cur;
        railRefs.current.forEach((b, i) => b && b.classList.toggle("on", i === cur));
      }

      /* live readouts */
      if (pctRef.current) pctRef.current.textContent = String(out.pct);
      if (barRef.current) barRef.current.style.transform = `scaleX(${out.pct / 100})`;
      if (frameRef.current) frameRef.current.textContent = `${pad(Math.round(p * (TOTAL_FRAMES - 1)) + 1, 3)} / ${TOTAL_FRAMES}`;
      if (progRef.current) progRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
      if (hintRef.current) hintRef.current.style.opacity = String(1 - seg(p, 0.01, 0.05));
      if (navRef.current) navRef.current.style.opacity = (1 - seg(p, 0.05, 0.1)).toFixed(3);
      if (heroRef.current) heroRef.current.style.transform = `translate3d(${(mouse.x * -10).toFixed(1)}px, ${(mouse.y * -6).toFixed(1)}px, 0)`;
      root.style.setProperty("--hue", accentHue(p).toFixed(1));

      /* the dive opens an iris in the film, revealing the live studio behind it */
      const t = seg(p, 0.955, 0.995);
      const iris = t * t * (3 - 2 * t);
      const st = stickRef.current;
      if (st) {
        st.classList.toggle("iris-on", iris > 0.001);
        st.style.setProperty("--iris", `${(iris * 115).toFixed(1)}%`);
      }
      if (studioEl) {
        studioEl.style.transform = iris >= 1 ? "" : `scale(${(0.97 + 0.03 * iris).toFixed(4)})`;
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  const jump = (frac: number) => {
    const root = wrap.current;
    if (!root) return;
    const top = root.getBoundingClientRect().top + window.scrollY;
    const span = root.offsetHeight - window.innerHeight;
    const y = top + span * frac;
    if (lenis) lenis.scrollTo(y);
    else window.scrollTo({ top: y, behavior: reducedMotion() ? "auto" : "smooth" });
  };
  const toStudio = () => {
    const el = document.getElementById("studio");
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0 });
    else el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
  };

  const bodies: Record<string, ReactNode> = {
    hero: (
      <>
        <h1 className="hero-title" ref={heroRef} aria-label="MODUL">
          {"MODUL".split("").map((ch, i) => <span key={i} style={vars({ "--i": i })}>{ch}</span>)}
        </h1>
        <p className="hero-sub">THE FUTURE OF QR.</p>
      </>
    ),
    gather: (
      <>
        <h2>Noise becomes <em>signal.</em></h2>
        <p>Every code starts as scattered modules. Keep scrolling and watch them lock into a grid a camera can read.</p>
      </>
    ),
    depth: (
      <>
        <h2>Give it <em>depth.</em></h2>
        <p>Each module is a piece of your data. Height is just a way to feel how dense, how heavy, how much you are asking a phone to resolve.</p>
      </>
    ),
    style: (
      <>
        <h2>Make it <em>yours.</em></h2>
        <p>Dots, corners, gradients, logos. Every style previews live and is checked for contrast before you export.</p>
        <ul className="chips"><li>Classic</li><li>Cobalt</li><li>Ember</li></ul>
      </>
    ),
    scan: (
      <>
        <h2>Light the <em>code.</em></h2>
        <p>One pass reads contrast, size, margin, density and error correction, then scores how reliably it will scan.</p>
      </>
    ),
    ship: (
      <>
        <h2>Ship it <em>anywhere.</em></h2>
        <p>PNG, JPG or SVG in one click, or Ctrl / ⌘ + S. Recent codes stay one tap away.</p>
        <ul className="chips"><li>PNG</li><li>JPG</li><li>SVG</li></ul>
      </>
    ),
    cta: (
      <>
        <h2 className="big">Your <em>turn.</em></h2>
        <button className="ss-cta" onClick={toStudio}>
          Open the studio
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </button>
      </>
    ),
  };

  return (
    <div className="ss" ref={wrap}>
      <div className="ss-stick" ref={stickRef}>
        <canvas ref={cv} className="ss-canvas" aria-hidden="true" />
        <div className="ss-glow" aria-hidden="true" />
        <div className="ss-vignette" aria-hidden="true" />
        <div className="ss-grain" aria-hidden="true" />
        <i className="ss-prog" ref={progRef} aria-hidden="true" />

        <header className="ss-nav" ref={navRef}>
          <span className="ss-brand"><i />modul<em>QR studio</em></span>
          <button className="ss-skip" onClick={toStudio}>Skip to studio</button>
        </header>

        {CH.map((c, i) => (
          <section key={c.id} ref={(el) => { chRefs.current[i] = el; }} className={`ch ch-${c.id}`} aria-label={c.label}>
            {c.id !== "hero" && c.id !== "cta" && <span className="kick"><b>{c.num}</b> — {c.label.toUpperCase()}</span>}
            {bodies[c.id]}
            {c.id === "scan" && (
              <div className="readout">
                <div className="pct"><b ref={pctRef}>0</b><i>%</i></div>
                <span className="pct-label">Scan readability</span>
                <div className="pct-bar"><i ref={barRef} /></div>
                <div className="pct-meta"><span>Contrast 4:1+</span><span>Error fix up to 30%</span></div>
              </div>
            )}
          </section>
        ))}

        <div className="ss-hint" ref={hintRef} aria-hidden="true"><span>SCROLL</span><i /></div>

        <nav className="ss-rail" aria-label="Chapters">
          {CH.map((c, i) => (
            <button key={c.id} ref={(el) => { railRefs.current[i] = el; }} onClick={() => jump(c.a + 0.012)} aria-label={`${c.num} ${c.label}`}>
              <em>{c.label}</em><i />
            </button>
          ))}
        </nav>

        <div className="ss-hud" aria-hidden="true">
          <span>FRAME <b ref={frameRef}>001 / {TOTAL_FRAMES}</b></span>
        </div>
      </div>
    </div>
  );
}