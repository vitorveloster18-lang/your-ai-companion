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
  thinkingDelay: number; // s
  emotionDuration: number; // s
  idleReturnDelay: number; // s
  autoEmotion: boolean;
  showBubbles: boolean;
  showStatus: boolean;
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
    happy: true,
    sad: true,
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
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed,
      videoLoop: { ...DEFAULT_SETTINGS.videoLoop, ...(parsed.videoLoop || {}) },
      videoData: { ...(parsed.videoData || {}) },
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
