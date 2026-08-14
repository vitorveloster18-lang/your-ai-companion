import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import "../styles/agent.css";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AvatarStage, type AvatarStageHandle } from "@/components/AvatarStage";
import { AvatarOrb } from "@/components/AvatarOrb";
import {
  type AppSettings,
  type VideoKey,
  loadSettings,
  saveSettings,
  detectEmotion,
  loadAvatarVideos,
} from "@/lib/settings";
import {
  type AgentConfig,
  loadAgents,
  saveAgents,
  loadActiveAgentId,
  saveActiveAgentId,
  sendToAgent,
} from "@/lib/agents";
import { appendHistory, buildContext } from "@/lib/memory";
import { speak, stopSpeech } from "@/lib/tts";
import { attachMicLevel } from "@/lib/audio-level";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Avatar Agent Studio" },
      { name: "description", content: "Interface de avatar em vídeo com estados interativos, voz, legenda e configurações persistentes." },
      { property: "og:title", content: "Avatar Agent Studio" },
      { property: "og:description", content: "Avatar em vídeo com estados vivos acionados por interação, voz e legenda minimalista." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgentPage,
});

const STATUS_LABELS: Record<string, string> = {
  standby: "Em standby",
  idle: "Pronto",
  listening: "Ouvindo",
  thinking: "Pensando",
  speaking: "Falando",
  enter: "Chegando",
  leave: "Saindo",
  happy: "Feliz",
  sad: "Triste",
  shy: "Tímida",
  smug: "Convencida",
  surprised: "Surpresa",
  confused: "Confusa",
  angry: "Irritada",
  sleepy: "Sonolenta",
  standby_to_listening: "Ouvindo",
  listening_to_standby: "Em standby",
  standby_to_speaking: "Falando",
  speaking_to_standby: "Em standby",
};

type Bubble = { id: number; text: string; role: "user" | "agent"; ts: number };

function generateId() { return Math.random().toString(36).substring(2, 15); }

const BUBBLE_TIMEOUT = 8000;
const MAX_VISIBLE_BUBBLES = 3;

function AgentPage() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [agentState, setAgentState] = useState<VideoKey>(
    () => (loadSettings().startInStandby ? "standby" : "idle")
  );
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [sendPulse, setSendPulse] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [mood, setMood] = useState<VideoKey | null>(null);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const micDetachRef = useRef<(() => void) | null>(null);
  const stageRef = useRef<AvatarStageHandle>(null);
  const settingsRef = useRef(settings);
  const agentsRef = useRef<AgentConfig[]>([]);
  const activeAgentIdRef = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { activeAgentIdRef.current = activeAgentId; }, [activeAgentId]);

  // Load agents from local storage
  useEffect(() => {
    setAgents(loadAgents());
    setActiveAgentId(loadActiveAgentId());
  }, []);

  const updateAgents = useCallback((list: AgentConfig[]) => {
    setAgents(list);
    saveAgents(list);
  }, []);
  const updateActiveAgent = useCallback((id: string | null) => {
    setActiveAgentId(id);
    saveActiveAgentId(id);
  }, []);


  // Bubble cleanup
  useEffect(() => {
    if (bubbles.length === 0) return;
    const timers = bubbles.map((b) =>
      setTimeout(() => setBubbles((prev) => prev.filter((x) => x.id !== b.id)),
        BUBBLE_TIMEOUT - (Date.now() - b.ts))
    );
    return () => timers.forEach(clearTimeout);
  }, [bubbles]);

  // Stage helpers — no-op (resolved immediately) when the orb renderer is active
  const isOrb = settings.renderMode === "orb";
  const isOrbRef = useRef(isOrb);
  useEffect(() => { isOrbRef.current = isOrb; }, [isOrb]);

  const playTransition = useCallback((key: VideoKey) => new Promise<void>((res) => {
    setAgentState(key);
    if (isOrbRef.current || !stageRef.current) { res(); return; }
    stageRef.current.playTransition(key, () => res());
  }), []);
  const showState = useCallback((key: VideoKey, loop = true) => {
    setAgentState(key);
    if (isOrbRef.current) return;
    stageRef.current?.showState(key, loop);
  }, []);
  const hideState = useCallback(() => new Promise<void>((res) => {
    if (isOrbRef.current || !stageRef.current) { res(); return; }
    stageRef.current.hideState(() => res());
  }), []);
  const playEmotion = useCallback((key: VideoKey) => new Promise<void>((res) => {
    setMood(key);
    if (isOrbRef.current || !stageRef.current) {
      setTimeout(() => res(), settingsRef.current.emotionDuration * 1000);
      return;
    }
    stageRef.current.playEmotion(key, () => res());
  }), []);


  // Load videos from cloud and run enter sequence
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sid = settingsRef.current.sessionId;
        if (sid) {
          const cloudVideos = await loadAvatarVideos(sid);
          if (!cancelled && Object.keys(cloudVideos).length > 0) {
            const merged = {
              ...settingsRef.current,
              videoData: { ...settingsRef.current.videoData, ...cloudVideos },
            };
            settingsRef.current = merged;
            saveSettings(merged);
            setSettings(merged);
          }
        }
      } catch (e) { console.warn("Cloud video load failed", e); }
      if (cancelled) return;
      // standby layer auto-runs; play enter once on top
      await playTransition("enter");
      setAgentState("standby");
    })();
    return () => { cancelled = true; };
  }, [playTransition]);

  const addBubble = (text: string, role: "user" | "agent") => {
    setBubbles((prev) => [...prev, { id: Date.now() + Math.random(), text, role, ts: Date.now() }]);
  };

  const speakText = (text: string) =>
    new Promise<void>((resolve) => {
      const s = settingsRef.current;
      if (!s.voiceEnabled || !("speechSynthesis" in window)) { resolve(); return; }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = s.voiceLang;
      u.rate = s.speechRate;
      u.pitch = s.speechPitch;
      const voices = window.speechSynthesis.getVoices();
      const chosen = voices.find((v) => v.name === s.voiceName);
      if (chosen) u.voice = chosen;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const s = settingsRef.current;
    setSendPulse(true);
    setTimeout(() => setSendPulse(false), 300);
    addBubble(text, "user");
    setInput("");

    // user stops talking → listening_to_standby → thinking
    await hideState();
    await playTransition("listening_to_standby");
    showState("thinking", true);

    try {
      const url = `${s.supabaseUrl}/functions/v1/${s.functionName}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.supabaseKey}` },
        body: JSON.stringify({ message: text, session_id: s.sessionId }),
      });
      if (!response.ok) throw new Error("Erro na API");
      const data = await response.json();
      const replyText = data.response || data.text || data.reply || "";
      const apiEmotion: VideoKey | undefined = data.emotion;
      addBubble(replyText, "agent");

      if (s.thinkingDelay > 0) await new Promise((r) => setTimeout(r, s.thinkingDelay * 1000));

      // hide thinking → standby_to_speaking → speaking
      await hideState();
      await playTransition("standby_to_speaking");
      showState("speaking", true);

      const detected = (apiEmotion as VideoKey) || (s.autoEmotion ? detectEmotion(replyText) : null);

      // Speak audio + optional emotion overlay
      const tasks: Promise<void>[] = [speakText(replyText)];
      if (detected) {
        tasks.push(new Promise<void>((res) => {
          setTimeout(() => playEmotion(detected).then(res), 1000);
        }));
      }
      await Promise.all(tasks);

      // Finish: hide speaking → speaking_to_standby
      await hideState();
      if (s.standbyDelay > 0) await new Promise((r) => setTimeout(r, s.standbyDelay * 1000));
      await playTransition("speaking_to_standby");
      setAgentState("standby");
    } catch (e) {
      console.error(e);
      addBubble("Algo deu errado. Tente novamente.", "agent");
      await hideState();
      await playTransition("speaking_to_standby");
      setAgentState("standby");
    }
  };

  const stopListening = () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  const startListening = () => {
    const s = settingsRef.current;
    if (!s.micEnabled) { alert("Microfone desativado nas configurações."); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Seu navegador não suporta reconhecimento de voz. Use Chrome."); return; }
    const recognition = new SR();
    recognition.lang = s.voiceLang;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = async () => {
      setIsRecording(true);
      await playTransition("standby_to_listening");
      showState("listening", true);
    };
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      stopListening();
      sendMessage(text);
    };
    recognition.onend = () => stopListening();
    recognition.onerror = () => stopListening();
    recognitionRef.current = recognition;
    recognition.start();
  };

  const onInputFocus = async () => {
    if (agentState === "standby") {
      await playTransition("standby_to_listening");
      showState("listening", true);
    }
  };

  // Ensure session id
  useEffect(() => {
    if (!settings.sessionId) setSettings((s) => ({ ...s, sessionId: generateId() }));
  }, [settings.sessionId]);

  // Leave on page hide
  useEffect(() => {
    const handler = () => {
      setFadeOut(true);
      stageRef.current?.playTransition("leave");
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const visibleBubbles = bubbles.slice(-MAX_VISIBLE_BUBBLES);
  const hasStandby = !!settings.videoData["standby"];

  return (
    <div className={`stage-shell ${fadeOut ? "fading" : ""}`}>
      <AvatarStage ref={stageRef} settings={settings} onStateChange={setAgentState} />

      {mounted && !hasStandby && (
        <div className="stage-placeholder-wrap">
          <div className="stage-placeholder">
            <div className="placeholder-pulse" />
            <div className="placeholder-label">{STATUS_LABELS[agentState] || agentState}</div>
            <small>Carregue os vídeos no Avatar Creator</small>
          </div>
        </div>
      )}

      <button
        className="settings-trigger floating"
        onClick={() => setSettingsOpen(true)}
        aria-label="Configurações"
      >
        <SettingsIcon />
      </button>

      {settings.showStatus && (
        <div className="status-bar floating">
          <div className={`status-dot ${agentState}`} />
          <span className="status-text">{STATUS_LABELS[agentState] || agentState}</span>
        </div>
      )}

      {settings.showBubbles && (visibleBubbles.length > 0 || agentState === "thinking") && (
        <div className="subtitle-area">
          {agentState === "thinking" ? (
            <div className="subtitle thinking">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          ) : (
            (() => {
              const last = visibleBubbles[visibleBubbles.length - 1];
              return last ? (
                <div key={last.id} className={`subtitle ${last.role}`}>
                  {last.role === "user" && <span className="subtitle-tag">você</span>}
                  <span className="subtitle-text">{last.text}</span>
                </div>
              ) : null;
            })()
          )}
        </div>
      )}

      <div className="floating-input">
        <div className="input-glass">
          <button
            className={`mic-button ${isRecording ? "recording" : ""}`}
            onClick={() => (isRecording ? stopListening() : startListening())}
            aria-label="Microfone"
            disabled={!settings.micEnabled}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={onInputFocus}
            onKeyDown={(e) => { if (e.key === "Enter") sendMessage(input); }}
            placeholder="Digite uma mensagem..."
            autoComplete="off"
          />
          <button
            className={`send-button ${sendPulse ? "clicked" : ""}`}
            onClick={() => sendMessage(input)}
            aria-label="Enviar"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          </button>
        </div>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={setSettings}
      />
    </div>
  );
}
