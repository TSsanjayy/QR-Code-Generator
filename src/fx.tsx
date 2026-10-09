import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

/* One reaction per kind of change. react(kind) animates the code card (Web Animations),
   mounts an overlay (rings, sweeps, corner brackets, dimension lines) and a short callout. */
export type FxKind = "data" | "morph" | "color" | "wash" | "shield" | "size" | "margin" | "stamp" | "flip" | "reset" | "badge" | "skin";
export interface FxState { k: FxKind; n: number; label?: string; color?: string; mg?: number }

const EASE = "cubic-bezier(.22,1,.36,1)";
const SPRING = "cubic-bezier(.3,1.4,.5,1)";
const P = "perspective(900px)";
const tilt: Keyframe[] = [
  { transform: `${P} rotateY(0) rotateX(0)` },
  { transform: `${P} rotateY(16deg) rotateX(-7deg) scale(1.03)`, offset: 0.35 },
  { transform: `${P} rotateY(-7deg) rotateX(3deg)`, offset: 0.7 },
  { transform: `${P} rotateY(0) rotateX(0)` },
];
const blip = (s: number): Keyframe[] => [{ transform: "none" }, { transform: `scale(${s})`, offset: 0.4 }, { transform: "none" }];

const CARD: Partial<Record<FxKind, [Keyframe[], KeyframeAnimationOptions]>> = {
  data: [[{ filter: "brightness(1)", transform: "none" }, { filter: "brightness(1.1)", transform: "scale(1.012)", offset: 0.35 }, { filter: "brightness(1)", transform: "none" }], { duration: 300 }],
  morph: [[{ transform: "scale(.93) rotate(-1.5deg)", filter: "blur(5px)" }, { transform: "scale(1.03) rotate(.6deg)", filter: "blur(0)", offset: 0.6 }, { transform: "none" }], { duration: 560, easing: SPRING }],
  color: [blip(1.02), { duration: 260 }],
  size: [blip(1.025), { duration: 240 }],
  wash: [tilt, { duration: 800, easing: EASE }],
  skin: [tilt, { duration: 800, easing: EASE }],
  shield: [[{ transform: "none" }, { transform: "scale(.97)", offset: 0.3 }, { transform: "scale(1.02)", offset: 0.6 }, { transform: "none" }], { duration: 520 }],
  stamp: [[{ transform: "scale(1)" }, { transform: "scale(.9,1.08)", offset: 0.25 }, { transform: "scale(1.05,.96)", offset: 0.55 }, { transform: "scale(1)" }], { duration: 620, easing: EASE }],
  flip: [[{ transform: `${P} rotateY(0deg)` }, { transform: `${P} rotateY(360deg)` }], { duration: 750, easing: "cubic-bezier(.5,0,.2,1)" }],
  reset: [[{ transform: "rotate(0) scale(1)" }, { transform: "rotate(-360deg) scale(.78)", offset: 0.6 }, { transform: "rotate(-360deg) scale(1)" }], { duration: 700, easing: "cubic-bezier(.5,0,.2,1)" }],
};
const SOFT = new Set<FxKind>(["data", "color", "size", "margin"]); // fire on every drag/keystroke, so rate-limit

export function useFx(card: { current: HTMLElement | null }) {
  const [fx, setFx] = useState<FxState | null>(null);
  const last = useRef(0);
  const anim = useRef<Animation | null>(null);

  const react = useCallback((k: FxKind, extra: Partial<FxState> = {}) => {
    const now = performance.now();
    if (SOFT.has(k) && now - last.current < 170) return;
    last.current = now;
    setFx({ k, n: now, ...extra });
    const a = CARD[k];
    if (a && card.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      anim.current?.cancel(); // never stack two reactions
      anim.current = card.current.animate(a[0], a[1]);
    }
  }, [card]);

  useEffect(() => {
    if (!fx) return;
    const id = window.setTimeout(() => setFx(null), 1500);
    return () => window.clearTimeout(id);
  }, [fx]);

  return { fx, react };
}

export function FxLayer({ fx }: { fx: FxState | null }) {
  if (!fx) return null;
  return (
    <>
      <span key={fx.n} className={`fx fx-${fx.k}`} aria-hidden="true"
        style={{ "--fc": fx.color ?? "var(--acc)", "--mg": fx.mg ?? 0 } as CSSProperties}>
        <i className="ring" /><i className="line" /><i className="wash" />
        <b className="c tl" /><b className="c tr" /><b className="c bl" /><b className="c br" />
        <u className="dim h" /><u className="dim v" />
        <s className="qz o" /><s className="qz n" />
      </span>
      {fx.label && <span key={`l${fx.n}`} className="callout" role="status">{fx.label}</span>}
    </>
  );
}