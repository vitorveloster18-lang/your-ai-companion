import { useEffect, useRef } from "react";
import { getAudioLevel } from "@/lib/audio-level";
import type { VideoKey } from "@/lib/settings";

type Props = { state: VideoKey; mood?: VideoKey | null; intensity?: number };

type Palette = { a: [number, number, number]; b: [number, number, number] };

const PALETTES: Record<string, Palette> = {
  standby: { a: [150, 120, 255], b: [90, 70, 190] },
  idle: { a: [150, 120, 255], b: [90, 70, 190] },
  listening: { a: [110, 220, 255], b: [60, 120, 220] },
  thinking: { a: [180, 160, 255], b: [110, 90, 220] },
  speaking: { a: [255, 170, 120], b: [230, 90, 140] },
  happy: { a: [255, 195, 90], b: [255, 110, 120] },
  sad: { a: [90, 150, 255], b: [50, 80, 180] },
  shy: { a: [255, 160, 200], b: [220, 110, 180] },
  smug: { a: [200, 170, 255], b: [140, 90, 220] },
  surprised: { a: [110, 240, 255], b: [60, 170, 230] },
  confused: { a: [180, 200, 220], b: [110, 130, 170] },
  angry: { a: [255, 110, 90], b: [200, 40, 60] },
  sleepy: { a: [140, 150, 200], b: [80, 90, 150] },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rgb = (c: number[], alpha: number) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha})`;

type Star = { x: number; y: number; z: number; s: number };
type Shock = { r: number; a: number };
type Dust = { ang: number; rad: number; sp: number; sz: number; ph: number };

export function AvatarOrb({ state, mood, intensity = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const moodRef = useRef(mood);
  const intRef = useRef(intensity);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { moodRef.current = mood; }, [mood]);
  useEffect(() => { intRef.current = intensity; }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    let smoothLevel = 0;
    let peak = 0;
    let lastPeakAt = 0;
    const cur: Palette = {
      a: [...PALETTES.standby.a] as [number, number, number],
      b: [...PALETTES.standby.b] as [number, number, number],
    };

    const stars: Star[] = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random(), z: Math.random() * 0.8 + 0.2, s: Math.random() * 1.6 + 0.4,
    }));
    const dust: Dust[] = Array.from({ length: 46 }, () => ({
      ang: Math.random() * Math.PI * 2,
      rad: 1.35 + Math.random() * 1.5,
      sp: (Math.random() * 0.5 + 0.25) * (Math.random() < 0.4 ? -1 : 1),
      sz: Math.random() * 1.8 + 0.7,
      ph: Math.random() * Math.PI * 2,
    }));
    const shocks: Shock[] = [];
    const spectrum = new Array(72).fill(0);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const s = stateRef.current;
      const k = intRef.current;
      const target = PALETTES[moodRef.current || s] || PALETTES.standby;

      for (let i = 0; i < 3; i++) {
        cur.a[i] = lerp(cur.a[i], target.a[i], 0.04);
        cur.b[i] = lerp(cur.b[i], target.b[i], 0.04);
      }

      const raw = getAudioLevel();
      smoothLevel = lerp(smoothLevel, raw, raw > smoothLevel ? 0.35 : 0.08);
      peak = Math.max(peak * 0.94, smoothLevel);

      const speaking = s === "speaking";
      const listening = s === "listening" || s === "standby_to_listening";
      const thinking = s === "thinking";
      const active = speaking || listening;

      const base = Math.min(w, h) * 0.19;
      const breath = Math.sin(t * 0.9) * base * 0.035;
      const react = active ? smoothLevel * base * 0.55 * k : 0;
      const radius = base + breath + react;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // --- Starfield drifting ---
      for (const st of stars) {
        const x = ((st.x + t * 0.004 * st.z) % 1) * w;
        const y = ((st.y + t * 0.0015 * st.z) % 1) * h;
        const tw = 0.25 + Math.abs(Math.sin(t * 1.4 + st.x * 30)) * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, st.s * st.z, 0, Math.PI * 2);
        ctx.fillStyle = rgb(cur.a, tw * 0.35 * st.z);
        ctx.fill();
      }

      // --- Nebula aura blobs ---
      for (let i = 0; i < 3; i++) {
        const ang = t * (0.18 + i * 0.07) + (i / 3) * Math.PI * 2;
        const dist = radius * (1.1 + i * 0.35) * (1 + smoothLevel * 0.3);
        const bx = cx + Math.cos(ang) * dist * 0.5;
        const by = cy + Math.sin(ang * 1.3) * dist * 0.4;
        const br = radius * (1.8 + i * 0.5);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, rgb(i % 2 ? cur.b : cur.a, 0.16 * k));
        g.addColorStop(1, rgb(cur.b, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Outer glow ---
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 3.4);
      glow.addColorStop(0, rgb(cur.a, 0.3 + smoothLevel * 0.2));
      glow.addColorStop(0.45, rgb(cur.b, 0.12));
      glow.addColorStop(1, rgb(cur.b, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // --- Shockwaves on loud peaks while speaking ---
      if (speaking && smoothLevel > 0.42 && t - lastPeakAt > 0.35) {
        lastPeakAt = t;
        shocks.push({ r: radius * 0.9, a: 0.5 });
      }
      for (let i = shocks.length - 1; i >= 0; i--) {
        const sh = shocks[i];
        sh.r += Math.min(w, h) * 0.012;
        sh.a *= 0.955;
        if (sh.a < 0.02) { shocks.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(cx, cy, sh.r, 0, Math.PI * 2);
        ctx.strokeStyle = rgb(cur.a, sh.a);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // --- Radial spectrum bars ---
      const bars = spectrum.length;
      for (let i = 0; i < bars; i++) {
        const noise =
          Math.sin(t * 3.1 + i * 0.7) * 0.5 + Math.sin(t * 1.7 + i * 1.9) * 0.5;
        const drive = active ? smoothLevel : thinking ? 0.18 : 0.07;
        const target2 = Math.max(0, drive * (0.55 + noise * 0.45));
        spectrum[i] = lerp(spectrum[i], target2, 0.2);
        const ang = (i / bars) * Math.PI * 2 - Math.PI / 2 + t * 0.05;
        const r0 = radius * 1.16;
        const len = radius * (0.08 + spectrum[i] * 1.05 * k);
        const x0 = cx + Math.cos(ang) * r0;
        const y0 = cy + Math.sin(ang) * r0;
        const x1 = cx + Math.cos(ang) * (r0 + len);
        const y1 = cy + Math.sin(ang) * (r0 + len);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = rgb(cur.a, 0.18 + spectrum[i] * 0.6);
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // --- Concentric reactive rings ---
      const rings = 5;
      for (let r = rings; r >= 1; r--) {
        const spread = listening ? 1 - r * 0.06 : 1 + r * 0.16;
        const rr = radius * spread + (speaking ? smoothLevel * r * 10 : 0);
        ctx.beginPath();
        const points = 160;
        for (let i = 0; i <= points; i++) {
          const ang = (i / points) * Math.PI * 2;
          const wave =
            Math.sin(ang * (3 + r) + t * (1.4 + r * 0.25)) *
            (radius * 0.035 + smoothLevel * radius * 0.22 * k) *
            (speaking ? 1 : listening ? 0.6 : 0.35);
          const rad = rr + wave;
          const x = cx + Math.cos(ang) * rad;
          const y = cy + Math.sin(ang) * rad;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = rgb(cur.a, 0.06 + (rings - r) * 0.05);
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // --- Orbiting dust ring (3D-ish tilt) ---
      for (const d of dust) {
        d.ang += d.sp * 0.006 * (1 + smoothLevel);
        const orbit = radius * d.rad * (1 + Math.sin(t * 0.7 + d.ph) * 0.05);
        const x = cx + Math.cos(d.ang) * orbit;
        const y = cy + Math.sin(d.ang) * orbit * 0.42;
        const depth = (Math.sin(d.ang) + 1) / 2;
        ctx.beginPath();
        ctx.arc(x, y, d.sz * (0.6 + depth * 0.9), 0, Math.PI * 2);
        ctx.fillStyle = rgb(cur.a, 0.12 + depth * 0.4);
        ctx.fill();
      }

      // --- Core disc with liquid edge ---
      ctx.save();
      ctx.beginPath();
      const cp = 220;
      for (let i = 0; i <= cp; i++) {
        const ang = (i / cp) * Math.PI * 2;
        const wob =
          Math.sin(ang * 3 + t * 1.1) * radius * 0.02 +
          Math.sin(ang * 5 - t * 1.7) * radius * (0.015 + smoothLevel * 0.09 * k);
        const rad = radius + wob;
        const x = cx + Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.clip();
      const core = ctx.createRadialGradient(
        cx - radius * 0.25, cy - radius * 0.3, radius * 0.1,
        cx, cy, radius,
      );
      core.addColorStop(0, rgb(cur.a, 0.95));
      core.addColorStop(0.65, rgb(cur.b, 0.9));
      core.addColorStop(1, rgb(cur.b, 0.8));
      ctx.fillStyle = core;
      ctx.fillRect(cx - radius * 1.5, cy - radius * 1.5, radius * 3, radius * 3);

      // internal energy filaments
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        for (let x = -1; x <= 1; x += 0.02) {
          const y =
            Math.sin(x * 3 + t * (1.2 + i * 0.4) + i) *
            (0.18 + smoothLevel * 0.5 * k) * (1 - Math.abs(x));
          const px = cx + x * radius;
          const py = cy + y * radius + (i - 1.5) * radius * 0.18;
          if (x === -1) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = rgb([255, 255, 255], 0.06 + smoothLevel * 0.18);
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      ctx.restore();

      // --- Specular highlight + rim ---
      const hl = ctx.createRadialGradient(
        cx - radius * 0.35, cy - radius * 0.45, 0,
        cx - radius * 0.35, cy - radius * 0.45, radius * 0.9,
      );
      hl.addColorStop(0, "rgba(255,255,255,0.35)");
      hl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hl;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, radius * (0.72 + smoothLevel * 0.12), 0, Math.PI * 2);
      ctx.strokeStyle = rgb([255, 255, 255], 0.18);
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.02, 0, Math.PI * 2);
      ctx.strokeStyle = rgb(cur.a, 0.35 + peak * 0.4);
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // --- Thinking particles orbiting ---
      if (thinking) {
        for (let i = 0; i < 9; i++) {
          const ang = t * 1.6 + (i / 9) * Math.PI * 2;
          const orbit = radius * (1.5 + Math.sin(t + i) * 0.08);
          const x = cx + Math.cos(ang) * orbit;
          const y = cy + Math.sin(ang) * orbit * 0.55;
          const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
          g.addColorStop(0, rgb(cur.a, 0.9));
          g.addColorStop(1, rgb(cur.a, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = "source-over";

      t += 0.016;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="avatar-orb" aria-hidden />;
}
