// All 18 video keys
export type VideoKey =
  // Base loops
  | "standby"
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  // Transitions
  | "enter"
  | "leave"
  | "standby_to_listening"
  | "listening_to_standby"
  | "standby_to_speaking"
  | "speaking_to_standby"
  // Emotions (happy is also a base loop)
  | "happy"
  | "sad"
  | "shy"
  | "smug"
  | "surprised"
  | "confused"
  | "angry"
  | "sleepy";

// Backward-compat alias: many places used AvatarStateName
export type AvatarStateName = VideoKey;

export type VideoCategory = "loop" | "transition" | "emotion";

export type VideoMeta = {
  key: VideoKey;
  filename: string;
  category: VideoCategory;
  emoji: string;
  label: string;
  description: string;
  when: string;
  defaultLoop: boolean;
  triggers?: string[]; // emotion trigger words (pt-BR)
};

export const VIDEO_LIBRARY: VideoMeta[] = [
  // ===== LOOPS =====
  { key: "standby", filename: "standby.mp4", category: "loop", emoji: "🌅", label: "Standby",
    description: "Vista lateral, completamente parada, esperando",
    when: "Ao abrir o app e após cada interação", defaultLoop: true },
  { key: "idle", filename: "idle.mp4", category: "loop", emoji: "🌙", label: "Idle",
    description: "Em pé, respirando suavemente",
    when: "Momento ativo breve", defaultLoop: true },
  { key: "listening", filename: "listening.mp4", category: "loop", emoji: "👂", label: "Listening",
    description: "Atenta, focada no usuário",
    when: "Usuário está falando", defaultLoop: true },
  { key: "thinking", filename: "thinking.mp4", category: "loop", emoji: "💭", label: "Thinking",
    description: "Processando resposta",
    when: "Esperando o agente", defaultLoop: true },
  { key: "speaking", filename: "speaking.mp4", category: "loop", emoji: "🗣️", label: "Speaking",
    description: "Falando, expressiva",
    when: "Agente respondendo", defaultLoop: true },
  { key: "happy", filename: "happy.mp4", category: "loop", emoji: "😊", label: "Happy",
    description: "Expressão alegre",
    when: "Loop base e gatilho de emoção", defaultLoop: true,
    triggers: ["ótimo","otimo","maravilhoso","feliz","alegre","perfeito","excelente","adorei","amei"] },

  // ===== TRANSITIONS =====
  { key: "enter", filename: "enter.mp4", category: "transition", emoji: "🚪", label: "Enter",
    description: "Entrada do avatar",
    when: "App abre", defaultLoop: false },
  { key: "leave", filename: "leave.mp4", category: "transition", emoji: "👋", label: "Leave",
    description: "Saída do avatar",
    when: "Sessão termina", defaultLoop: false },
  { key: "standby_to_listening", filename: "standby_to_listening.mp4", category: "transition", emoji: "↗️", label: "Standby → Listening",
    description: "Vira-se para ouvir",
    when: "Usuário começa a falar", defaultLoop: false },
  { key: "listening_to_standby", filename: "listening_to_standby.mp4", category: "transition", emoji: "↙️", label: "Listening → Standby",
    description: "Volta ao standby",
    when: "Usuário para de falar", defaultLoop: false },
  { key: "standby_to_speaking", filename: "standby_to_speaking.mp4", category: "transition", emoji: "↗️", label: "Standby → Speaking",
    description: "Prepara para falar",
    when: "Agente vai responder", defaultLoop: false },
  { key: "speaking_to_standby", filename: "speaking_to_standby.mp4", category: "transition", emoji: "↙️", label: "Speaking → Standby",
    description: "Termina de falar",
    when: "Agente termina", defaultLoop: false },

  // ===== EMOTIONS =====
  { key: "sad", filename: "sad.mp4", category: "emotion", emoji: "😢", label: "Sad",
    description: "Expressão triste",
    when: "Palavras tristes na resposta", defaultLoop: false,
    triggers: ["triste","lamento","sinto muito","desculpe","infelizmente","pena"] },
  { key: "shy", filename: "shy.mp4", category: "emotion", emoji: "☺️", label: "Shy",
    description: "Tímida",
    when: "Palavras ternas", defaultLoop: false,
    triggers: ["envergonhada","tímida","timida","que fofo","obrigada","fico sem graça"] },
  { key: "smug", filename: "smug.mp4", category: "emotion", emoji: "😏", label: "Smug",
    description: "Convencida",
    when: "Palavras óbvias", defaultLoop: false,
    triggers: ["claro","obviamente","sabia","como eu disse","naturalmente"] },
  { key: "surprised", filename: "surprised.mp4", category: "emotion", emoji: "😲", label: "Surprised",
    description: "Surpresa",
    when: "Palavras de surpresa", defaultLoop: false,
    triggers: ["incrível","incrivel","surpreendente","uau","não acredito","nao acredito","sério","serio"] },
  { key: "confused", filename: "confused.mp4", category: "emotion", emoji: "😕", label: "Confused",
    description: "Confusa",
    when: "Palavras de confusão", defaultLoop: false,
    triggers: ["não entendi","nao entendi","pode repetir","confuso","não tenho certeza","nao tenho certeza","como assim"] },
  { key: "angry", filename: "angry.mp4", category: "emotion", emoji: "😠", label: "Angry",
    description: "Irritada",
    when: "Palavras de raiva", defaultLoop: false,
    triggers: ["não gosto","nao gosto","irritante","chateada","isso é errado","isso e errado","pare"] },
  { key: "sleepy", filename: "sleepy.mp4", category: "emotion", emoji: "😴", label: "Sleepy",
    description: "Sonolenta",
    when: "Palavras de cansaço", defaultLoop: false,
    triggers: ["cansada","sono","dormir","descansando","que horas são","que horas sao"] },
];

export const VIDEO_KEYS = VIDEO_LIBRARY.map((v) => v.key) as VideoKey[];
export const AVATAR_STATES: VideoKey[] = VIDEO_KEYS;

export const DEFAULT_VIDEOS: Record<VideoKey, string> = VIDEO_LIBRARY.reduce(
  (acc, v) => { acc[v.key] = `/avatar/${v.filename}`; return acc; },
  {} as Record<VideoKey, string>
);

export const DEFAULT_LOOP: Record<VideoKey, boolean> = VIDEO_LIBRARY.reduce(
  (acc, v) => { acc[v.key] = v.defaultLoop; return acc; },
  {} as Record<VideoKey, boolean>
);

export const DEFAULT_STATE_PROMPTS: Record<VideoKey, string> = VIDEO_LIBRARY.reduce(
  (acc, v) => {
    acc[v.key] = `Anime girl, ${v.label.toLowerCase()} state — ${v.description}, soft cinematic light, ${v.defaultLoop ? "seamless loop" : "single take"}`;
    return acc;
  },
  {} as Record<VideoKey, string>
);

export const DEFAULT_STATE_DURATIONS: Record<VideoKey, number> = VIDEO_LIBRARY.reduce(
  (acc, v) => { acc[v.key] = v.category === "loop" ? 5 : 3; return acc; },
  {} as Record<VideoKey, number>
);

export type ApiProvider = "replicate" | "did" | "stability" | "custom";

export type AppSettings = {
  // Connection
  supabaseUrl: string;
  supabaseKey: string;
  functionName: string;
  sessionId: string;

  // Videos — value can be a single URL or an array of variant URLs (cycled to avoid loop seams)
  videoData: Partial<Record<VideoKey, string | string[]>>;
  videoLoop: Record<VideoKey, boolean>;

  // Voice
  voiceEnabled: boolean;
  speechRate: number;
  speechPitch: number;
  voiceLang: string;
  voiceName: string;
  micEnabled: boolean;

  // Sync
  thinkingDelay: number;
  emotionDuration: number;
  idleReturnDelay: number;
  autoEmotion: boolean;
  showBubbles: boolean;
  showStatus: boolean;

  // Stage behavior (NEW)
  standbyDelay: number;          // seconds to wait before returning to standby
  standbyTransitionDuration: number; // seconds for the standby crossfade
  startInStandby: boolean;

  // Avatar Creator
  referenceImage: string;
  apiProvider: ApiProvider;
  apiKey: string;
  customApiUrl: string;
  statePrompts: Record<VideoKey, string>;
  stateDurations: Record<VideoKey, number>;
};

const SETTINGS_KEY = "agent.settings.v1";

function makeSessionId() {
  return Math.random().toString(36).substring(2, 15);
}

export const DEFAULT_SETTINGS: AppSettings = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseKey: "SUA-CHAVE-ANON",
  functionName: "chat",
  sessionId: makeSessionId(),

  videoData: {},
  videoLoop: { ...DEFAULT_LOOP },

  voiceEnabled: true,
  speechRate: 1.0,
  speechPitch: 1.1,
  voiceLang: "pt-BR",
  voiceName: "",
  micEnabled: true,

  thinkingDelay: 0.5,
  emotionDuration: 2,
  idleReturnDelay: 1,
  autoEmotion: true,
  showBubbles: true,
  showStatus: true,

  standbyDelay: 3,
  standbyTransitionDuration: 1,
  startInStandby: true,

  referenceImage: "",
  apiProvider: "replicate",
  apiKey: "",
  customApiUrl: "",
  statePrompts: { ...DEFAULT_STATE_PROMPTS },
  stateDurations: { ...DEFAULT_STATE_DURATIONS },
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      videoLoop: { ...DEFAULT_LOOP, ...(parsed.videoLoop || {}) },
      videoData: { ...(parsed.videoData || {}) },
      statePrompts: { ...DEFAULT_STATE_PROMPTS, ...(parsed.statePrompts || {}) },
      stateDurations: { ...DEFAULT_STATE_DURATIONS, ...(parsed.stateDurations || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (e) {
    console.warn("Failed to save settings", e);
  }
}

/** Returns all uploaded variant URLs for a key (empty array if none). */
export function getVideoVariants(key: VideoKey, settings: AppSettings): string[] {
  const v = settings.videoData[key];
  if (!v) return [];
  return Array.isArray(v) ? v.filter(Boolean) : [v];
}

/** Returns user-uploaded data URL (first variant), or null if unavailable. */
export function getVideoSrc(key: VideoKey, settings: AppSettings): string | null {
  const list = getVideoVariants(key, settings);
  return list[0] || null;
}

// ===== Storage helpers =====
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "avatar-videos";

async function loadVideosForSession(
  sessionId: string
): Promise<{ videos: Partial<Record<VideoKey, string>>; latest: number }> {
  const { data, error } = await supabase.storage.from(BUCKET).list(sessionId, {
    limit: 100,
    sortBy: { column: "name", order: "asc" },
  });
  if (error || !data) return { videos: {}, latest: 0 };

  const videos: Partial<Record<VideoKey, string>> = {};
  let latest = 0;
  for (const f of data) {
    const key = f.name.replace(/\.mp4$/, "") as VideoKey;
    if (VIDEO_KEYS.includes(key)) {
      const stamp = Date.parse(f.updated_at || f.created_at || "") || 0;
      latest = Math.max(latest, stamp);
      const { data: pub } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(`${sessionId}/${f.name}`);
      videos[key] = `${pub.publicUrl}${stamp ? `?t=${stamp}` : ""}`;
    }
  }
  return { videos, latest };
}

export async function uploadAvatarVideo(
  key: VideoKey,
  file: File,
  sessionId: string
): Promise<string> {
  const path = `${sessionId}/${key}.mp4`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: "video/mp4" });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // bust cache
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function deleteAvatarVideo(key: VideoKey, sessionId: string) {
  const path = `${sessionId}/${key}.mp4`;
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function loadAvatarVideos(
  sessionId: string
): Promise<Partial<Record<VideoKey, string>>> {
  const current = await loadVideosForSession(sessionId);
  if (Object.keys(current.videos).length > 0) return current.videos;

  const { data: folders } = await supabase.storage.from(BUCKET).list("", {
    limit: 100,
    sortBy: { column: "updated_at", order: "desc" },
  });

  let best = current;
  for (const folder of folders || []) {
    if (!folder.name || folder.name.includes(".")) continue;
    const candidate = await loadVideosForSession(folder.name);
    const bestCount = Object.keys(best.videos).length;
    const candidateCount = Object.keys(candidate.videos).length;
    if (candidateCount > bestCount || (candidateCount === bestCount && candidate.latest > best.latest)) {
      best = candidate;
    }
  }
  return best.videos;
}

/** Compatibility: returns user data URL or default file path (may 404 if absent). */
export function resolveVideoSrc(key: VideoKey, settings: AppSettings): string {
  return getVideoSrc(key, settings) || DEFAULT_VIDEOS[key];
}

/** Detects an emotion video key from text using triggers. Returns null if none. */
export function detectEmotion(text: string): VideoKey | null {
  const lower = text.toLowerCase();
  const emotions = VIDEO_LIBRARY.filter((v) => v.category === "emotion" || v.key === "happy");
  for (const e of emotions) {
    if (!e.triggers) continue;
    if (e.triggers.some((t) => lower.includes(t))) return e.key;
  }
  return null;
}
