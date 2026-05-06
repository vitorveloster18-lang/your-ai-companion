import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import "../styles/agent.css";
import { SettingsPanel } from "@/components/SettingsPanel";
import {
  type AppSettings,
  type AvatarStateName,
  loadSettings,
  resolveVideoSrc,
} from "@/lib/settings";

export const Route = createFileRoute("/")({
  component: AgentPage,
});

const STATUS_LABELS: Record<string, string> = {
  idle: "Pronto",
  listening: "Ouvindo",
  thinking: "Pensando",
  speaking: "Falando",
  happy: "Feliz",
  sad: "Triste",
};

type Bubble = { id: number; text: string; role: "user" | "agent"; ts: number };

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ParticleBackground() {
  const particles = useMemo(
    () =>
      Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 20 + 15,
        delay: Math.random() * 20,
        opacity: Math.random() * 0.4 + 0.1,
      })),
    []
  );
  return (
    <div className="particles" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function AgentPage() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [agentState, setAgentState] = useState<AvatarStateName>("idle");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [sendPulse, setSendPulse] = useState(false);

  const recognitionRef = useRef<any>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [activeLayer, setActiveLayer] = useState<"A" | "B">("A");
  const [srcA, setSrcA] = useState(() => resolveVideoSrc("idle", loadSettings()));
  const [srcB, setSrcB] = useState<string | null>(null);
  const stateRef = useRef<AvatarStateName>("idle");
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const setState = useCallback((s: AvatarStateName) => {
    stateRef.current = s;
    setAgentState(s);
  }, []);

  // Crossfade videos when state OR videoData changes
  useEffect(() => {
    const nextSrc = resolveVideoSrc(agentState, settings);
    const currentSrc = activeLayer === "A" ? srcA : srcB;
    if (currentSrc === nextSrc) return;

    if (activeLayer === "A") {
      setSrcB(nextSrc);
      requestAnimationFrame(() => {
        videoBRef.current?.play().catch(() => {});
        setActiveLayer("B");
      });
    } else {
      setSrcA(nextSrc);
      requestAnimationFrame(() => {
        videoARef.current?.play().catch(() => {});
        setActiveLayer("A");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentState, settings.videoData]);

  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [bubbles, agentState]);

  const addBubble = (text: string, role: "user" | "agent") => {
    setBubbles((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), text, role, ts: Date.now() },
    ]);
  };

  const speakText = (text: string, emotion: string) =>
    new Promise<void>((resolve) => {
      const s = settingsRef.current;
      if (!s.voiceEnabled || !("speechSynthesis" in window)) {
        setState("idle");
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = s.voiceLang;
      u.rate = s.speechRate;
      u.pitch = s.speechPitch;
      const voices = window.speechSynthesis.getVoices();
      const chosen = voices.find((v) => v.name === s.voiceName);
      if (chosen) u.voice = chosen;
      u.onstart = () => setState("speaking");
      u.onend = () => {
        const useEmotion = s.autoEmotion && emotion && emotion !== "idle";
        if (useEmotion && (["happy","sad","listening","thinking","speaking"] as AvatarStateName[]).includes(emotion as AvatarStateName)) {
          setState(emotion as AvatarStateName);
          setTimeout(() => setState("idle"), s.emotionDuration * 1000);
        } else {
          setTimeout(() => setState("idle"), s.idleReturnDelay * 1000);
        }
        resolve();
      };
      u.onerror = () => {
        setState("idle");
        resolve();
      };
      window.speechSynthesis.speak(u);
    });

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const s = settingsRef.current;
    setSendPulse(true);
    setTimeout(() => setSendPulse(false), 300);
    addBubble(text, "user");
    setInput("");
    setState("thinking");

    try {
      const url = `${s.supabaseUrl}/functions/v1/${s.functionName}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${s.supabaseKey}`,
        },
        body: JSON.stringify({ message: text, session_id: s.sessionId }),
      });
      if (!response.ok) throw new Error("Erro na API");
      const data = await response.json();
      const replyText = data.response || data.text || data.reply || "";
      const emotion = data.emotion || "idle";
      addBubble(replyText, "agent");
      if (s.thinkingDelay > 0) {
        await new Promise((r) => setTimeout(r, s.thinkingDelay * 1000));
      }
      await speakText(replyText, emotion);
    } catch (e) {
      console.error(e);
      addBubble("Algo deu errado. Tente novamente.", "agent");
      setState("idle");
    }
  };

  const stopListening = () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (stateRef.current === "listening") setState("idle");
  };

  const startListening = () => {
    if (!settingsRef.current.micEnabled) {
      alert("Microfone desativado nas configurações.");
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Seu navegador não suporta reconhecimento de voz. Use Chrome.");
      return;
    }
    const recognition = new SR();
    recognition.lang = settingsRef.current.voiceLang;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => {
      setIsRecording(true);
      setState("listening");
    };
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      stopListening();
      sendMessage(text);
    };
    recognition.onend = () => stopListening();
    recognition.onerror = () => {
      stopListening();
      setState("idle");
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  // Ensure session id exists
  useEffect(() => {
    if (!settings.sessionId) {
      setSettings((s) => ({ ...s, sessionId: generateId() }));
    }
  }, [settings.sessionId]);

  return (
    <div className="agent-shell">
      <ParticleBackground />

      <button
        className="settings-trigger"
        onClick={() => setSettingsOpen(true)}
        aria-label="Configurações"
      >
        <SettingsIcon />
      </button>

      {settings.showStatus && (
        <div className="status-bar">
          <div className={`status-dot ${agentState}`} />
          <span className="status-text">{STATUS_LABELS[agentState] || agentState}</span>
        </div>
      )}

      <div className="avatar-container">
        <div className={`avatar-glow ${agentState}`}>
          <video
            ref={videoARef}
            className={`avatar-video ${activeLayer === "A" ? "active" : ""}`}
            autoPlay
            loop={settings.videoLoop[agentState] ?? true}
            muted
            playsInline
            src={srcA}
          />
          {srcB && (
            <video
              ref={videoBRef}
              className={`avatar-video ${activeLayer === "B" ? "active" : ""}`}
              autoPlay
              loop={settings.videoLoop[agentState] ?? true}
              muted
              playsInline
              src={srcB}
            />
          )}
        </div>
      </div>

      {settings.showBubbles && (
        <div className="chat-area" ref={chatAreaRef}>
          {bubbles.map((b) => (
            <div key={b.id} className={`bubble-row ${b.role}`}>
              {b.role === "agent" && (
                <div className="bubble-avatar" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
                  </svg>
                </div>
              )}
              <div className="bubble-wrap">
                <div className={`bubble ${b.role}`}>{b.text}</div>
                <div className="bubble-time">{formatTime(b.ts)}</div>
              </div>
            </div>
          ))}
          {agentState === "thinking" && (
            <div className="bubble-row agent">
              <div className="bubble-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
                </svg>
              </div>
              <div className="bubble-wrap">
                <div className="bubble agent typing">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="input-area">
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
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage(input);
            }}
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
