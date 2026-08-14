import { attachElementLevel, startSimulatedLevel, stopSimulatedLevel } from "./audio-level";
import type { AppSettings } from "./settings";

let currentAudio: HTMLAudioElement | null = null;
let detach: (() => void) | null = null;

export function stopSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  detach?.();
  detach = null;
  stopSimulatedLevel();
}

function speakWebSpeech(text: string, s: AppSettings): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = s.voiceLang;
    u.rate = s.speechRate;
    u.pitch = s.speechPitch;
    const chosen = window.speechSynthesis.getVoices().find((v) => v.name === s.voiceName);
    if (chosen) u.voice = chosen;
    const done = () => { stopSimulatedLevel(); resolve(); };
    u.onend = done;
    u.onerror = done;
    startSimulatedLevel();
    window.speechSynthesis.speak(u);
  });
}

async function playUrl(url: string, revoke: boolean): Promise<void> {
  const audio = new Audio(url);
  audio.crossOrigin = "anonymous";
  currentAudio = audio;
  detach = attachElementLevel(audio);
  await audio.play();
  await new Promise<void>((resolve) => {
    const done = () => {
      detach?.();
      detach = null;
      currentAudio = null;
      if (revoke) URL.revokeObjectURL(url);
      resolve();
    };
    audio.onended = done;
    audio.onerror = done;
  });
}

async function speakKokoroLocal(text: string, s: AppSettings): Promise<void> {
  const { synthLocalKokoro } = await import("./kokoro-local");
  const url = await synthLocalKokoro(text, s.kokoroVoice, s.speechRate);
  await playUrl(url, true);
}

async function speakKokoro(text: string, s: AppSettings): Promise<void> {
  const base = (s.kokoroUrl || "").replace(/\/$/, "");
  if (!base) throw new Error("Kokoro URL vazia");
  const res = await fetch(base, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(s.kokoroKey ? { Authorization: `Bearer ${s.kokoroKey}` } : {}),
    },
    body: JSON.stringify({
      model: s.kokoroModel || "kokoro",
      input: text,
      voice: s.kokoroVoice || "af_heart",
      response_format: "mp3",
      speed: s.speechRate,
    }),
  });
  if (!res.ok) throw new Error(`Kokoro ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.crossOrigin = "anonymous";
  currentAudio = audio;
  detach = attachElementLevel(audio);
  await audio.play();
  await new Promise<void>((resolve) => {
    const done = () => {
      detach?.();
      detach = null;
      currentAudio = null;
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onended = done;
    audio.onerror = done;
  });
}

/** Speaks text with the configured provider, falling back to Web Speech. */
export async function speak(text: string, s: AppSettings): Promise<void> {
  if (!s.voiceEnabled || !text.trim()) return;
  if (s.ttsProvider === "kokoro") {
    try {
      await speakKokoro(text, s);
      return;
    } catch (e) {
      console.warn("Kokoro TTS falhou, usando voz do navegador", e);
    }
  }
  await speakWebSpeech(text, s);
}
