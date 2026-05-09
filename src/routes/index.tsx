import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import "../styles/agent.css";
import { SettingsPanel } from "@/components/SettingsPanel";
import {
  type AppSettings,
  type VideoKey,
  loadSettings,
  saveSettings,
  getVideoSrc,
  detectEmotion,
  loadAvatarVideos,
  VIDEO_LIBRARY,
} from "@/lib/settings";

export const Route = createFileRoute("/")({ component: AgentPage });

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
function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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

  const recognitionRef = useRef<any>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [activeLayer, setActiveLayer] = useState<"A" | "B">("A");
  const [srcA, setSrcA] = useState<string | null>(null);
  const [srcB, setSrcB] = useState<string | null>(null);
  const [labelA, setLabelA] = useState<string>("standby");
  const [labelB, setLabelB] = useState<string>("");
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Cleanup bubbles after timeout
  useEffect(() => {
    if (bubbles.length === 0) return;
    const timers = bubbles.map((b) =>
      setTimeout(() => {
        setBubbles((prev) => prev.filter((x) => x.id !== b.id));
      }, BUBBLE_TIMEOUT - (Date.now() - b.ts))
    );
    return () => timers.forEach(clearTimeout);
  }, [bubbles]);

  /** Plays a video on the inactive layer and crossfades to it. Resolves when:
   *   - looping: as soon as fade completes
   *   - non-looping: when the video naturally ends (or after maxDuration safety) */
  const playVideo = useCallback(
    (key: VideoKey, opts: { loop?: boolean; transitionMs?: number; maxMs?: number } = {}) => {
      return new Promise<void>((resolve) => {
        const s = settingsRef.current;
        const src = getVideoSrc(key, s);
        if (!src) {
          // Skip transitions/emotions silently if missing.
          // For base loops, just update label so placeholder shows.
          setAgentState(key);
          if (opts.loop) {
            // keep showing placeholder; resolve immediately
            resolve();
          } else {
            // skip non-looping silently
            resolve();
          }
          return;
        }
        const meta = VIDEO_LIBRARY.find((v) => v.key === key);
        const looping = opts.loop ?? (meta?.defaultLoop ?? false);
        const transitionMs = opts.transitionMs ?? 500;

        setAgentState(key);

        // Pick inactive layer
        const useB = activeLayerRef.current === "A";
        if (useB) {
          setSrcB(src);
          setLabelB(key);
        } else {
          setSrcA(src);
          setLabelA(key);
        }

        // Wait one frame for the video element to update src, then play and switch
        requestAnimationFrame(() => {
          const target = useB ? videoBRef.current : videoARef.current;
          if (target) {
            target.loop = looping;
            target.currentTime = 0;
            target.play().catch(() => {});

            const onEnded = () => {
              target.removeEventListener("ended", onEnded);
              resolve();
            };
            if (!looping) target.addEventListener("ended", onEnded);

            // safety timeout for non-looping if 'ended' never fires
            if (!looping) {
              setTimeout(() => {
                target.removeEventListener("ended", onEnded);
                resolve();
              }, opts.maxMs ?? 12000);
            } else {
              // resolve after fade for loops
              setTimeout(resolve, transitionMs);
            }
          } else {
            resolve();
          }
          activeLayerRef.current = useB ? "B" : "A";
          setActiveLayer(useB ? "B" : "A");
        });
      });
    },
    []
  );

  const activeLayerRef = useRef<"A" | "B">("A");

  // Sequence runner — guards against overlapping flows
  const seqIdRef = useRef(0);

  const runSequence = useCallback(
    async (steps: Array<{ key: VideoKey; loop?: boolean; transitionMs?: number; maxMs?: number; afterMs?: number }>) => {
      const id = ++seqIdRef.current;
      for (const step of steps) {
        if (id !== seqIdRef.current) return; // cancelled
        await playVideo(step.key, {
          loop: step.loop,
          transitionMs: step.transitionMs,
          maxMs: step.maxMs,
        });
        if (step.afterMs) {
          await new Promise((r) => setTimeout(r, step.afterMs));
        }
      }
    },
    [playVideo]
  );

  // Load videos from cloud storage on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sid = settingsRef.current.sessionId;
        if (!sid) return;
        const cloudVideos = await loadAvatarVideos(sid);
        if (cancelled || Object.keys(cloudVideos).length === 0) return;
        const merged = {
          ...settingsRef.current,
          videoData: { ...settingsRef.current.videoData, ...cloudVideos },
        };
        settingsRef.current = merged;
        saveSettings(merged);
        setSettings(merged);
        const trans = merged.standbyTransitionDuration * 1000;
        runSequence([{ key: "standby", loop: true, transitionMs: trans }]);
      } catch (e) { console.warn("Cloud video load failed", e); }
    })();
    return () => { cancelled = true; };
  }, [runSequence]);

  // ON APP OPEN
  useEffect(() => {
    const s = settingsRef.current;
    const trans = s.standbyTransitionDuration * 1000;
    runSequence([
      { key: "enter", loop: false, transitionMs: trans },
      { key: "standby", loop: true, transitionMs: trans },
    ]);
    return () => {
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const trans = s.standbyTransitionDuration * 1000;

    // listening_to_standby → thinking (we treat the user already finished typing)
    runSequence([
      { key: "listening_to_standby", loop: false, transitionMs: trans },
      { key: "thinking", loop: true, transitionMs: trans },
    ]);

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

      // standby_to_speaking → speaking (loop)
      const speakSeq = runSequence([
        { key: "standby_to_speaking", loop: false, transitionMs: trans },
        { key: "speaking", loop: true, transitionMs: trans },
      ]);

      // Speak audio simultaneously
      await Promise.all([speakSeq, speakText(replyText)]);

      // Detect emotion (server-provided wins, otherwise scan text)
      const detected = (apiEmotion as VideoKey) || (s.autoEmotion ? detectEmotion(replyText) : null);

      const finalSteps: Array<{ key: VideoKey; loop?: boolean; transitionMs?: number; maxMs?: number; afterMs?: number }> = [];
      if (detected) {
        finalSteps.push({ key: detected, loop: false, transitionMs: trans, maxMs: s.emotionDuration * 1000 + 4000 });
      }
      finalSteps.push({ key: "speaking_to_standby", loop: false, transitionMs: trans });
      finalSteps.push({ key: "standby", loop: true, transitionMs: trans, afterMs: s.standbyDelay * 1000 });
      runSequence(finalSteps);
    } catch (e) {
      console.error(e);
      addBubble("Algo deu errado. Tente novamente.", "agent");
      runSequence([
        { key: "speaking_to_standby", loop: false },
        { key: "standby", loop: true },
      ]);
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
    const trans = s.standbyTransitionDuration * 1000;
    recognition.onstart = () => {
      setIsRecording(true);
      runSequence([
        { key: "standby_to_listening", loop: false, transitionMs: trans },
        { key: "listening", loop: true, transitionMs: trans },
      ]);
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

  // First focus on input → trigger standby_to_listening (subtle)
  const onInputFocus = () => {
    if (agentState === "standby") {
      const trans = settingsRef.current.standbyTransitionDuration * 1000;
      runSequence([
        { key: "standby_to_listening", loop: false, transitionMs: trans },
        { key: "listening", loop: true, transitionMs: trans },
      ]);
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
      const s = settingsRef.current;
      const trans = s.standbyTransitionDuration * 1000;
      runSequence([{ key: "leave", loop: false, transitionMs: trans }]);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [runSequence]);

  const visibleBubbles = bubbles.slice(-MAX_VISIBLE_BUBBLES);
  const showPlaceholder = !srcA && !srcB;
  const transSec = settings.standbyTransitionDuration;

  return (
    <div className={`stage-shell ${fadeOut ? "fading" : ""}`}>
      {/* Full-screen avatar background */}
      <div className="stage-bg">
        {showPlaceholder && (
          <div className="stage-placeholder">
            <div className="placeholder-pulse" />
            <div className="placeholder-label">{STATUS_LABELS[agentState] || agentState}</div>
            <small>Carregue os vídeos no Avatar Creator</small>
          </div>
        )}
        {srcA && (
          <video
            ref={videoARef}
            className={`stage-video ${activeLayer === "A" ? "active" : ""}`}
            style={{ transitionDuration: `${transSec}s` }}
            autoPlay muted playsInline
            src={srcA}
            key={`A-${labelA}`}
          />
        )}
        {srcB && (
          <video
            ref={videoBRef}
            className={`stage-video ${activeLayer === "B" ? "active" : ""}`}
            style={{ transitionDuration: `${transSec}s` }}
            autoPlay muted playsInline
            src={srcB}
            key={`B-${labelB}`}
          />
        )}
        <div className="stage-vignette" />
      </div>

      {/* Floating UI */}
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
