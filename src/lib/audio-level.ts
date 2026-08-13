// Shared real-time audio amplitude (0..1) used by the orb visualizer.

let level = 0;
let simTimer: ReturnType<typeof setInterval> | null = null;
let rafId: number | null = null;

export function getAudioLevel() {
  return level;
}

export function setAudioLevel(v: number) {
  level = Math.max(0, Math.min(1, v));
}

/** Fake but organic envelope, used when the source gives no analysable audio (Web Speech). */
export function startSimulatedLevel() {
  stopSimulatedLevel();
  let phase = 0;
  simTimer = setInterval(() => {
    phase += 0.25;
    const base = 0.35 + Math.sin(phase) * 0.18 + Math.sin(phase * 2.7) * 0.12;
    setAudioLevel(base + Math.random() * 0.15);
  }, 60);
}

export function stopSimulatedLevel() {
  if (simTimer) clearInterval(simTimer);
  simTimer = null;
  setAudioLevel(0);
}

function analyse(analyser: AnalyserNode) {
  const buf = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const x = (buf[i] - 128) / 128;
      sum += x * x;
    }
    setAudioLevel(Math.sqrt(sum / buf.length) * 3.2);
    rafId = requestAnimationFrame(tick);
  };
  tick();
}

function stopAnalyse() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  setAudioLevel(0);
}

let audioCtx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

/** Attaches the analyser to a playing <audio> element. Returns a detach fn. */
export function attachElementLevel(el: HTMLAudioElement): () => void {
  try {
    const c = ctx();
    const src = c.createMediaElementSource(el);
    const analyser = c.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    analyser.connect(c.destination);
    analyse(analyser);
    return () => {
      stopAnalyse();
      try { src.disconnect(); analyser.disconnect(); } catch { /* noop */ }
    };
  } catch {
    startSimulatedLevel();
    return () => stopSimulatedLevel();
  }
}

/** Listens to the microphone amplitude. Returns a detach fn. */
export async function attachMicLevel(): Promise<() => void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const c = ctx();
    const src = c.createMediaStreamSource(stream);
    const analyser = c.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    analyse(analyser);
    return () => {
      stopAnalyse();
      try { src.disconnect(); analyser.disconnect(); } catch { /* noop */ }
      stream.getTracks().forEach((t) => t.stop());
    };
  } catch {
    startSimulatedLevel();
    return () => stopSimulatedLevel();
  }
}
