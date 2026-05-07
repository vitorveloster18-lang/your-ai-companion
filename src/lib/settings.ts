export type AvatarStateName =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "happy"
  | "sad";

export const AVATAR_STATES: AvatarStateName[] = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "happy",
  "sad",
];

export const DEFAULT_VIDEOS: Record<AvatarStateName, string> = {
  idle: "/avatar/idle.mp4",
  listening: "/avatar/listening.mp4",
  thinking: "/avatar/thinking.mp4",
  speaking: "/avatar/speaking.mp4",
  happy: "/avatar/happy.mp4",
  sad: "/avatar/sad.mp4",
};

export const DEFAULT_STATE_PROMPTS: Record<AvatarStateName, string> = {
  idle:
    "Anime girl standing still, gentle breathing animation, slight body sway, eyes blinking slowly, calm and peaceful expression, soft light, seamless loop",
  listening:
    "Anime girl tilting head slightly, attentive expression, eyes wide open and focused, leaning forward gently, curious and engaged look, soft glow around her, seamless loop",
  thinking:
    "Anime girl looking up slightly, thoughtful expression, finger on chin, eyes moving as if thinking, subtle head movement, dreamy atmosphere, seamless loop",
  speaking:
    "Anime girl mouth moving naturally, talking expression, expressive eyes, gentle hand gesture, confident and warm look, seamless loop",
  happy:
    "Anime girl smiling brightly, eyes closed in happiness, small celebratory gesture, sparkling effect around her, joyful and energetic expression",
  sad:
    "Anime girl looking down softly, slightly sad expression, gentle melancholic mood, eyes with subtle tears, slow breathing, empathetic look",
};

export const DEFAULT_STATE_DURATIONS: Record<AvatarStateName, number> = {
  idle: 5,
  listening: 4,
  thinking: 4,
  speaking: 5,
  happy: 4,
  sad: 4,
};

export type ApiProvider = "replicate" | "did" | "stability" | "custom";

export type AppSettings = {
  // Connection
  supabaseUrl: string;
  supabaseKey: string;
  functionName: string;
  sessionId: string;

  // Avatar videos: base64 data URLs (or empty for default file)
  videoData: Partial<Record<AvatarStateName, string>>;
  videoLoop: Record<AvatarStateName, boolean>;

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

  // Avatar Creator
  referenceImage: string; // base64 data URL
  apiProvider: ApiProvider;
  apiKey: string;
  customApiUrl: string;
  statePrompts: Record<AvatarStateName, string>;
  stateDurations: Record<AvatarStateName, number>;
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
  videoLoop: {
    idle: true,
    listening: true,
    thinking: true,
    speaking: true,
    happy: false,
    sad: false,
  },

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
      videoLoop: { ...DEFAULT_SETTINGS.videoLoop, ...(parsed.videoLoop || {}) },
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

export function resolveVideoSrc(
  state: AvatarStateName,
  settings: AppSettings,
): string {
  return settings.videoData[state] || DEFAULT_VIDEOS[state];
}
