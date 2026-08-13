import { useEffect, useRef } from "react";
import { getAudioLevel } from "@/lib/audio-level";
import type { VideoKey } from "@/lib/settings";

type Props = { state: VideoKey; mood?: VideoKey | null };

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

export function AvatarOrb({ state, mood }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const moodRef = useRef(mood);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { moodRef.current = mood; }, [mood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    let smoothLevel = 0;
    const cur: Palette = {
      a: [...PALETTES.standby.a] as [number, number, number],
      b: [...PALETTES.standby.b] as [number, number, number],
    };

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
      const target = PALETTES[moodRef.current || s] || PALETTES.standby;

      for (let i = 0; i < 3; i++) {
        cur.a[i] = lerp(cur.a[i], target.a[i], 0.04);
        cur.b[i] = lerp(cur.b[i], target.b[i], 0.04);
      }

      const raw = getAudioLevel();
      smoothLevel = lerp(smoothLevel, raw, raw > smoothLevel ? 0.35 : 0.08);

      const speaking = s === "speaking";
      const listening = s === "listening" || s === "standby_to_listening";
      const thinking = s === "thinking";

      const base = Math.min(w, h) * 0.19;
      const breath = Math.sin(t * 0.9) * base * 0.035;
      const react = speaking || listening ? smoothLevel * base * 0.55 : 0;
      const radius = base + breath + react;

      ctx.clearRect(0, 0, w, h);

      // Outer glow
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 3.2);
      glow.addColorStop(0, rgb(cur.a, 0.28));
      glow.addColorStop(0.5, rgb(cur.b, 0.1));
      glow.addColorStop(1, rgb(cur.b, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Concentric reactive rings
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
            (radius * 0.035 + smoothLevel * radius * 0.22) *
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

      // Core disc
      const core = ctx.createRadialGradient(
        cx - radius * 0.25, cy - radius * 0.3, radius * 0.1,
        cx, cy, radius,
      );
      core.addColorStop(0, rgb(cur.a, 0.95));
      core.addColorStop(1, rgb(cur.b, 0.85));
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      // Inner highlight ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius * (0.72 + smoothLevel * 0.12), 0, Math.PI * 2);
      ctx.strokeStyle = rgb([255, 255, 255], 0.18);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Thinking particles orbiting
      if (thinking) {
        for (let i = 0; i < 7; i++) {
          const ang = t * 1.6 + (i / 7) * Math.PI * 2;
          const orbit = radius * (1.5 + Math.sin(t + i) * 0.08);
          const x = cx + Math.cos(ang) * orbit;
          const y = cy + Math.sin(ang) * orbit * 0.55;
          ctx.beginPath();
          ctx.arc(x, y, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = rgb(cur.a, 0.75);
          ctx.fill();
        }
      }

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
