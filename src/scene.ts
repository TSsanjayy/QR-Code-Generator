/* =========================================================
   MODUL · procedural 3D scene
   Every "frame" of the scroll film is drawn from one number: p (0 → 1).
   Pure canvas-2D with a hand-rolled perspective camera, so there are no
   image sequences to download and the film is always sharp at any size.
   ========================================================= */

export const N = 25; // modules per side (QR version 2)
const NEAR = 0.35;

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
export const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/* overshoot curve for the lock-in: 0 -> 1, with a small bounce past 1 */
const back = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

function hash(n: number) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

type Keys = [number, number][];
function kf(p: number, keys: Keys) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [p0, v0] = keys[i - 1];
      const [p1, v1] = keys[i];
      return mix(v0, v1, smooth((p - p0) / (p1 - p0)));
    }
  }
  return keys[keys.length - 1][1];
}

/* ---------- palette ---------- */
type RGB = [number, number, number];
const ACC: RGB = [255, 106, 61];
const NEU: RGB = [236, 234, 226];
const COB_A: RGB = [70, 110, 255];
const COB_B: RGB = [150, 92, 245];
const EMB_A: RGB = [255, 124, 64];
const EMB_B: RGB = [232, 52, 98];
const HOT: RGB = [255, 228, 208];
const mix3 = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** hue (deg) that the page glow follows while the code changes style */
export function accentHue(p: number) {
  const s = 2 * seg(p, 0.47, 0.6);
  const h = s < 1 ? mix(24, 226, smooth(s)) : mix(226, 378, smooth(s - 1));
  return mix(h, 232, smooth(seg(p, 0.88, 0.97))); // the finale settles on a cool blue
}

/* ---------- the code itself ---------- */
interface Cell {
  gx: number; gz: number; finder: boolean; d: number; hr: number;
  sx: number; sy: number; sz: number; rad: number; ss: number; ph: number; diag: number;
}
const CELLS: Cell[] = [];
(function build() {
  let k = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const inF = (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7);
      const sep = (r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8);
      let on = false;
      let finder = false;
      if (inF) {
        finder = true;
        const rr = r >= N - 7 ? r - (N - 7) : r;
        const cc = c >= N - 7 ? c - (N - 7) : c;
        const ring = rr === 0 || rr === 6 || cc === 0 || cc === 6;
        const core = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
        on = ring || core;
      } else if (sep) on = false;
      else if (r === 6) on = c % 2 === 0;
      else if (c === 6) on = r % 2 === 0;
      else if (r >= N - 9 && r <= N - 5 && c >= N - 9 && c <= N - 5) {
        const rr = r - (N - 9);
        const cc = c - (N - 9);
        on = rr === 0 || rr === 4 || cc === 0 || cc === 4 || (rr === 2 && cc === 2);
      } else on = hash(r * 131 + c * 7 + 17) < 0.47;
      if (!on) continue;

      const gx = c - N / 2 + 0.5;
      const gz = N / 2 - 0.5 - r;
      const th = hash(k * 5 + 1) * Math.PI * 2;
      const ph = Math.acos(2 * hash(k * 5 + 2) - 1);
      const rad = 7 + 15 * Math.cbrt(hash(k * 5 + 3));
      CELLS.push({
        gx, gz, finder,
        d: Math.hypot(gx, gz) / (N * 0.7072),
        hr: hash(k * 5 + 4),
        sx: rad * Math.sin(ph) * Math.cos(th),
        sy: rad * Math.cos(ph) * 0.65,
        sz: rad * Math.sin(ph) * Math.sin(th),
        rad,
        ss: 0.28 + 0.5 * hash(k * 5 + 5),
        ph: hash(k * 7 + 9) * Math.PI * 2,
        diag: clamp((gx + gz) / (2 * N) + 0.5),
      });
      k++;
    }
  }
})();

const NC = CELLS.length;
const ST = {
  x: new Float64Array(NC), y: new Float64Array(NC), z: new Float64Array(NC),
  a: new Float64Array(NC), b: new Float64Array(NC),
  r: new Float64Array(NC), g: new Float64Array(NC), bl: new Float64Array(NC),
  glow: new Float64Array(NC),
  vx: new Float64Array(NC), vy: new Float64Array(NC), vz: new Float64Array(NC),
};
const ORD = Array.from({ length: NC }, (_, i) => i);

const DUST = Array.from({ length: 170 }, (_, i) => ({
  x: (hash(i * 3 + 100) - 0.5) * 120,
  y: (hash(i * 3 + 101) - 0.5) * 70,
  z: (hash(i * 3 + 102) - 0.5) * 120,
  s: 0.7 + hash(i * 3 + 103) * 1.3,
}));

/* ---------- camera ---------- */
const FACES = [[2, 3, 7, 6], [1, 3, 7, 5], [0, 4, 6, 2], [4, 5, 7, 6], [0, 2, 3, 1]];
const NW: [number, number, number][] = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
const LIGHT = (() => { const l = Math.hypot(-0.35, 0.85, -0.4); return [-0.35 / l, 0.85 / l, -0.4 / l]; })();
const SHADE = NW.map((n) => 0.34 + 0.66 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]));

let cY = 1, sY = 0, cP = 1, sP = 0, DD = 30, CX = 0, CYS = 0, FOC = 500;
const V = new Float64Array(3);
const PXY = new Float64Array(2);
const NV = NW.map(() => new Float64Array(3));
const PX = new Float64Array(8);
const PY = new Float64Array(8);

function toView(x: number, y: number, z: number) {
  const x1 = x * cY + z * sY;
  const z1 = -x * sY + z * cY;
  V[0] = x1;
  V[1] = y * cP + z1 * sP;
  V[2] = -y * sP + z1 * cP + DD;
}
function proj(x: number, y: number, z: number) {
  toView(x, y, z);
  if (V[2] < NEAR) return false;
  PXY[0] = CX + (V[0] * FOC) / V[2];
  PXY[1] = CYS - (V[1] * FOC) / V[2];
  return true;
}
function line3(ctx: CanvasRenderingContext2D, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  toView(ax, ay, az);
  let x0 = V[0], y0 = V[1], z0 = V[2];
  toView(bx, by, bz);
  let x1 = V[0], y1 = V[1], z1 = V[2];
  if (z0 < NEAR && z1 < NEAR) return;
  if (z0 < NEAR) { const t = (NEAR - z0) / (z1 - z0); x0 += (x1 - x0) * t; y0 += (y1 - y0) * t; z0 = NEAR; }
  if (z1 < NEAR) { const t = (NEAR - z1) / (z0 - z1); x1 += (x0 - x1) * t; y1 += (y0 - y1) * t; z1 = NEAR; }
  ctx.moveTo(CX + (x0 * FOC) / z0, CYS - (y0 * FOC) / z0);
  ctx.lineTo(CX + (x1 * FOC) / z1, CYS - (y1 * FOC) / z1);
}

/* ---------- one frame ---------- */
export interface SceneOut { pct: number }

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  ctx.strokeStyle = `rgba(255,244,230,${a.toFixed(3)})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r * 1.4); ctx.lineTo(x, y + r * 1.4);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
  ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, 6.283); ctx.fill();
}

export function drawScene(
  ctx: CanvasRenderingContext2D, w: number, h: number, p: number, time: number,
  mouse: { x: number; y: number } = { x: 0, y: 0 },
): SceneOut {
  ctx.clearRect(0, 0, w, h);

  const narrow = w < 820;
  const base = Math.min(w, h);
  FOC = base * (narrow ? 0.66 : 0.64);
  CX = w * (narrow ? 0.5 : kf(p, [[0, 0.5], [0.09, 0.5], [0.17, 0.67], [0.88, 0.67], [0.94, 0.5], [1, 0.5]]));
  CYS = h * (narrow ? 0.64 : kf(p, [[0, 0.66], [0.14, 0.5], [1, 0.5]]));

  // a slow drift keeps the scene alive even when the scroll stops
  const driftY = Math.sin(time * 0.35) * 0.02;
  const driftP = Math.cos(time * 0.29) * 0.02;
  const yaw = kf(p, [[0, 0], [0.28, 0], [0.5, 1.1], [0.6, 0.7], [0.68, 0], [0.8, 0], [0.88, -0.45], [0.93, 0], [1, 0]]) + mouse.x * 0.14 + driftY;
  const pitch = Math.min(1.55, kf(p, [[0, 0.2], [0.14, 0.5], [0.28, 1.1], [0.4, 0.5], [0.5, 0.4], [0.6, 0.8], [0.68, 1.5], [0.8, 1.5], [0.88, 1.0], [0.93, 1.5], [1, 1.5]]) + mouse.y * 0.07 + driftP);
  DD = kf(p, [[0, 36], [0.28, 31], [0.5, 27], [0.68, 24], [0.8, 24], [0.88, 27], [0.93, 23], [0.96, 12], [0.995, 5]]);
  cY = Math.cos(yaw); sY = Math.sin(yaw); cP = Math.cos(pitch); sP = Math.sin(pitch);

  for (let k = 0; k < 5; k++) {
    const [nx, ny, nz] = NW[k];
    const x1 = nx * cY + nz * sY;
    const z1 = -nx * sY + nz * cY;
    NV[k][0] = x1; NV[k][1] = ny * cP + z1 * sP; NV[k][2] = -ny * sP + z1 * cP;
  }

  /* timeline */
  const tAsm = seg(p, 0.05, 0.27);
  const ex = ease(seg(p, 0.3, 0.46)) * (1 - ease(seg(p, 0.56, 0.66)));
  const sPh = 2 * seg(p, 0.47, 0.6);
  const beamT = seg(p, 0.66, 0.8);
  const dive = smooth(seg(p, 0.9, 0.955)); // 0 → 1 as we fall into the code
  const sp = smooth(seg(p, 0.93, 0.975)) * (1 - smooth(seg(p, 0.985, 0.995))); // sparkle strength fades as studio settles
  const beamZ = mix(N / 2 + 1.5, -N / 2 - 1.5, beamT);
  const bs = 0.9 - 0.15 * Math.sin(sPh * Math.PI);
  const asm = tAsm * 1.75;

  /* ground grid */
  const ga = 0.1 * seg(p, 0.18, 0.3) * (1 - seg(p, 0.62, 0.7)) + 0.12 * seg(p, 0.9, 0.95);
  if (ga > 0.003) {
    ctx.beginPath();
    for (let i = -30; i <= 30; i += 2) {
      line3(ctx, i, 0, -30, i, 0, 30);
      line3(ctx, -30, 0, i, 30, 0, i);
    }
    ctx.strokeStyle = `rgba(190,205,255,${ga.toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* shockwave: a ring snaps outward the moment the grid locks in */
  const rt = seg(p, 0.24, 0.36);
  if (rt > 0 && rt < 1) {
    const R = mix(2, N * 0.95, ease(rt));
    ctx.beginPath();
    for (let i = 0; i < 64; i++) {
      const a0 = (i / 64) * Math.PI * 2, a1 = ((i + 1) / 64) * Math.PI * 2;
      line3(ctx, Math.cos(a0) * R, 0.02, Math.sin(a0) * R, Math.cos(a1) * R, 0.02, Math.sin(a1) * R);
    }
    ctx.strokeStyle = "rgba(255,140,90," + (0.5 * (1 - rt)).toFixed(3) + ")";
    ctx.lineWidth = 2; ctx.stroke();
  }

  /* dust: gives the empty space depth and parallax */
  for (let i = 0; i < DUST.length; i++) {
    const d = DUST[i];
    if (!proj(d.x, d.y, d.z) || V[2] < 3) continue;
    const tw = 0.18 + 0.2 * Math.sin(time * 1.4 + i);
    ctx.fillStyle = `rgba(255,255,255,${tw.toFixed(2)})`;
    const s = d.s * clamp(14 / V[2], 0.5, 2);
    ctx.fillRect(PXY[0], PXY[1], s, s);
  }

  /* falling light streaks, weighted left, so the sides read as part of the scene */
  const fin = seg(p, 0.9, 0.96);
  if (fin > 0.01) {
    ctx.lineCap = "round";
    ctx.lineWidth = 1;
    for (let i = 0; i < 46; i++) {
      const x = Math.pow(hash(i * 11 + 500), 1.6) * w;   // the power pushes lines toward the left
      const spd = 0.15 + 0.35 * hash(i * 11 + 501);
      const len = (0.08 + 0.22 * hash(i * 11 + 502)) * h;
      const y = ((time * spd + hash(i * 11 + 503)) % 1) * (h + len) - len;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, "rgba(190,205,255,0)");
      g.addColorStop(1, `rgba(190,205,255,${(0.4 * fin * hash(i * 11 + 504)).toFixed(3)})`);
      ctx.strokeStyle = g;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
    }
  }

  /* cells: place, size, colour */
  for (let i = 0; i < NC; i++) {
    const c = CELLS[i];
    const lt = ease(clamp(asm - c.d * 0.75));
    const lh = back(clamp(asm - c.d * 0.75)); // position eases, size/height overshoot

    const ang = time * 0.12 + c.rad * 0.015;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const bx = c.sx * ca - c.sz * sa;
    const bz = c.sx * sa + c.sz * ca;
    const by = c.sy + Math.sin(time * 0.8 + c.ph) * 0.6;

    const tall = c.finder
      ? 4.2 + 0.8 * Math.sin(time * 1.3 + c.ph)
      : 0.7 + c.hr * 3.8 + 0.8 * Math.sin(time * 1.5 + c.gx * 0.55 + c.gz * 0.4);
    const glow = Math.exp(-((c.gz - beamZ) * (c.gz - beamZ)) / 2.6);
    const hh = 0.35 + tall * ex + glow * 0.55;

    const size = mix(c.ss, bs, lh);
    const H = mix(c.ss, hh, lh);
    ST.x[i] = mix(bx, c.gx, lt);
    ST.y[i] = mix(by, H / 2, lt);
    ST.z[i] = mix(bz, c.gz, lt);
    ST.a[i] = size / 2;
    ST.b[i] = H / 2;
    ST.glow[i] = glow;

    const p0 = c.finder ? ACC : NEU;
    const p1 = mix3(COB_A, COB_B, c.diag);
    const p2 = mix3(EMB_A, EMB_B, c.diag);
    let col = sPh < 1 ? mix3(p0, p1, smooth(sPh)) : mix3(p1, p2, smooth(sPh - 1));
    if (glow > 0.01) col = mix3(col, HOT, glow * 0.9);
    const done = beamT > 0 ? smooth(clamp((c.gz - beamZ) / 4)) * (1 - seg(p, 0.9, 0.95)) : 0;
    col = mix3(col, [63, 211, 145], done * 0.28);
    col = mix3(col, [18, 20, 30], dive * 0.82); // cubes sink to graphite blue
    const tw = Math.pow(Math.max(0, Math.sin(time * 2.6 + c.ph * 6 + c.hr * 30)), 14);
    col = mix3(col, [255, 255, 255], tw * sp * 0.55);
    ST.r[i] = col[0]; ST.g[i] = col[1]; ST.bl[i] = col[2];

    toView(ST.x[i], ST.y[i], ST.z[i]);
    ST.vx[i] = V[0]; ST.vy[i] = V[1]; ST.vz[i] = V[2];
  }
  ORD.sort((i, j) => ST.vz[j] - ST.vz[i]);

  /* backing plate: off-modules are never drawn, so without this the gaps punch
     pure-black holes through the code. Soft slate keeps them reading as recessed
     instead of void. Fades in as the grid assembles. */
  const bp = smooth(seg(p, 0.1, 0.3));
  if (bp > 0.01 && proj(0, 1.2, 0)) {
    const R2 = (FOC * N * 0.78) / V[2];
    const bg = ctx.createRadialGradient(PXY[0], PXY[1], 0, PXY[0], PXY[1], R2);
    bg.addColorStop(0, `rgba(16,18,28,${(0.94 * bp).toFixed(3)})`);
    bg.addColorStop(0.6, `rgba(11,13,21,${(0.6 * bp).toFixed(3)})`);
    bg.addColorStop(1, "rgba(9,11,19,0)");
    ctx.fillStyle = bg;
    ctx.fillRect(PXY[0] - R2, PXY[1] - R2, R2 * 2, R2 * 2);
  }

  /* cubes, far to near */
  for (let k = 0; k < NC; k++) {
    const i = ORD[k];
    if (ST.vz[i] < NEAR + 0.2) continue;
    const a = ST.a[i], b = ST.b[i];
    let ok = true;
    for (let ci = 0; ci < 8; ci++) {
      toView(ST.x[i] + (ci & 1 ? a : -a), ST.y[i] + (ci & 2 ? b : -b), ST.z[i] + (ci & 4 ? a : -a));
      if (V[2] < NEAR) { ok = false; break; }
      PX[ci] = CX + (V[0] * FOC) / V[2];
      PY[ci] = CYS - (V[1] * FOC) / V[2];
    }
    if (!ok) continue;
    for (let f = 0; f < 5; f++) {
      const n = NV[f];
      if (n[0] * ST.vx[i] + n[1] * ST.vy[i] + n[2] * ST.vz[i] >= -(f === 0 ? b : a)) continue;
      const sh = SHADE[f];
      const fg = clamp((ST.vz[i] - DD) / 22) * 0.5; // fade distant cubes toward the fog colour
      const R = mix(ST.r[i], 5, fg), G = mix(ST.g[i], 6, fg), B = mix(ST.bl[i], 10, fg);
      ctx.fillStyle = `rgb(${(R * sh) | 0},${(G * sh) | 0},${(B * sh) | 0})`;
      const q = FACES[f];
      ctx.beginPath();
      ctx.moveTo(PX[q[0]], PY[q[0]]);
      ctx.lineTo(PX[q[1]], PY[q[1]]);
      ctx.lineTo(PX[q[2]], PY[q[2]]);
      ctx.lineTo(PX[q[3]], PY[q[3]]);
      ctx.closePath();
      ctx.fill();
      if (f === 0) {
        ctx.strokeStyle = dive > 0.02 ? "rgba(170,190,255," + (0.12 + 0.45 * dive).toFixed(3) + ")" : "rgba(255,255,255,0.12)";
        ctx.lineWidth = 0.8 + dive * 0.8;
        ctx.stroke();
      }
    }
  }

  /* sparkles: a flare on each twinkling cube, plus free stars over the empty field */
  if (sp > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let i = 0; i < NC; i++) {
      const c = CELLS[i];
      const t = Math.pow(Math.max(0, Math.sin(time * 2.6 + c.ph * 6 + c.hr * 30)), 14);
      if (t < 0.12 || !proj(ST.x[i], ST.y[i] + ST.b[i], ST.z[i])) continue;
      star(ctx, PXY[0], PXY[1], (4 + 14 * t) * clamp(14 / V[2], 0.6, 2.2), t * sp);
    }
    for (let i = 0; i < 70; i++) {   // sparkles over the empty areas too
      const t = Math.pow(Math.max(0, Math.sin(time * 2 + hash(i * 9 + 700) * 20)), 10);
      if (t < 0.1) continue;
      star(ctx, hash(i * 9 + 701) * w, hash(i * 9 + 702) * h, 3 + 10 * t * (0.4 + hash(i * 9 + 703)), t * sp);
    }
    ctx.restore();
  }

  /* bloom on the modules the beam is touching */
  if (beamT > 0 && beamT < 1) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < NC; i++) {
      const gl = ST.glow[i];
      if (gl < 0.15) continue;
      if (!proj(ST.x[i], ST.y[i] + ST.b[i], ST.z[i])) continue;
      const r = ((FOC * ST.a[i] * 7) / V[2]) * (0.5 + gl);
      const g = ctx.createRadialGradient(PXY[0], PXY[1], 0, PXY[0], PXY[1], r);
      g.addColorStop(0, `rgba(255,150,100,${(gl * 0.5).toFixed(3)})`);
      g.addColorStop(1, "rgba(255,150,100,0)");
      ctx.fillStyle = g;
      ctx.fillRect(PXY[0] - r, PXY[1] - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  /* the scan beam */
  const ba = smooth(seg(beamT, 0, 0.04)) * (1 - smooth(seg(beamT, 0.96, 1)));
  if (ba > 0.01) {
    const xL = -N / 2 - 1.2, xR = N / 2 + 1.2;
    if (proj(xL, 0.5, beamZ)) {
      const lx = PXY[0], ly = PXY[1];
      if (proj(xR, 0.5, beamZ)) {
        const rx = PXY[0], ry = PXY[1];
        if (proj(xR, 0.5, beamZ + 5)) {
          const tx = PXY[0], ty = PXY[1];
          if (proj(xL, 0.5, beamZ + 5)) {
            const ux = PXY[0], uy = PXY[1];
            const g = ctx.createLinearGradient(0, ly, 0, uy);
            g.addColorStop(0, `rgba(255,120,70,${(0.32 * ba).toFixed(3)})`);
            g.addColorStop(1, "rgba(255,120,70,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(lx, ly); ctx.lineTo(rx, ry); ctx.lineTo(tx, ty); ctx.lineTo(ux, uy);
            ctx.closePath();
            ctx.fill();
          }
          ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry);
          ctx.strokeStyle = `rgba(255,110,60,${(0.28 * ba).toFixed(3)})`; ctx.lineWidth = 12; ctx.stroke();
          ctx.strokeStyle = `rgba(255,238,226,${ba.toFixed(3)})`; ctx.lineWidth = 2.5; ctx.stroke();
        }
      }
    }
  }

  /* scan-lock frame: closes in on the code, turns green when it passes */
  const fa = seg(p, 0.63, 0.66) * (1 - seg(p, 0.86, 0.9));
  if (fa > 0.01) {
    const hs = N / 2 + mix(8, 1.4, ease(seg(p, 0.63, 0.7)));
    const col = mix3(ACC, [63, 211, 145], smooth(seg(p, 0.8, 0.83)));
    ctx.strokeStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${fa.toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        if (!proj(hs * sx - 4 * sx, 0.02, hs * sz)) continue;
        const ax = PXY[0], ay = PXY[1];
        if (!proj(hs * sx, 0.02, hs * sz)) continue;
        const bx = PXY[0], by = PXY[1];
        if (!proj(hs * sx, 0.02, hs * sz - 4 * sz)) continue;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(PXY[0], PXY[1]); ctx.stroke();
      }
    }
  }

  return { pct: Math.round(98 * smooth(beamT)) };
}