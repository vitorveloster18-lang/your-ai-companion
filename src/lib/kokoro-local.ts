// Kokoro TTS running fully in the browser (WebGPU when available, WASM fallback).
// No API key and no server: the model is downloaded once and cached by the browser.

let ttsPromise: Promise<any> | null = null;

export const KOKORO_LOCAL_VOICES = [
  "af_heart", "af_bella", "af_nicole", "af_sarah", "af_sky",
  "am_adam", "am_michael", "bf_emma", "bf_isabella", "bm_george", "bm_lewis",
];

async function hasWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as any).gpu;
    if (!gpu) return false;
    const adapter = await gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

/** Loads (and caches) the local Kokoro model. */
export async function getLocalKokoro(): Promise<any> {
  if (!ttsPromise) {
    ttsPromise = (async () => {
      const { KokoroTTS } = await import("kokoro-js");
      const webgpu = await hasWebGPU();
      return KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: webgpu ? "fp32" : "q8",
        device: webgpu ? "webgpu" : "wasm",
      });
    })().catch((e) => {
      ttsPromise = null;
      throw e;
    });
  }
  return ttsPromise;
}

/** Synthesizes text locally and returns a playable blob URL (wav). */
export async function synthLocalKokoro(text: string, voice: string, speed: number): Promise<string> {
  const tts = await getLocalKokoro();
  const audio = await tts.generate(text, { voice: voice || "af_heart", speed: speed || 1 });
  const blob: Blob = audio.toBlob();
  return URL.createObjectURL(blob);
}
