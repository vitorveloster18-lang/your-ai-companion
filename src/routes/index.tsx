import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import "../styles/agent.css";

export const Route = createFileRoute("/")({
  component: AgentPage,
});

const CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseKey: "SUA-CHAVE-ANON",
  functionName: "chat",
  language: "pt-BR",
};

const VIDEOS: Record<string, string> = {
  idle: "/avatar/idle.mp4",
  listening: "/avatar/listening.mp4",
  thinking: "/avatar/thinking.mp4",
  speaking: "/avatar/speaking.mp4",
  happy: "/avatar/happy.mp4",
  sad: "/avatar/sad.mp4",
};

const STATUS_LABELS: Record<string, string> = {
  idle: "Pronto",
  listening: "Ouvindo",
  thinking: "Pensando",
  speaking: "Falando",
  happy: "Feliz",
  sad: "Triste",
};

type Bubble = { id: number; text: string; role: "user" | "agent" };

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function AgentPage() {
  const [agentState, setAgentState] = useState<string>("idle");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const sessionIdRef = useRef(generateId());
  const recognitionRef = useRef<any>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stateRef = useRef("idle");

  const setState = useCallback((s: string) => {
    stateRef.current = s;
    setAgentState(s);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const src = VIDEOS[agentState] || VIDEOS.idle;
    if (!v.src.endsWith(src)) {
      v.src = src;
      v.play().catch(() => {});
    }
  }, [agentState]);

  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [bubbles]);

  const addBubble = (text: string, role: "user" | "agent") => {
    setBubbles((prev) => [...prev, { id: Date.now() + Math.random(), text, role }]);
  };

  const speakText = (text: string, emotion: string) =>
    new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) {
        setState("idle");
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = CONFIG.language;
      u.rate = 1.0;
      u.pitch = 1.1;
      u.onstart = () => setState("speaking");
      u.onend = () => {
        if (emotion && emotion !== "idle" && VIDEOS[emotion]) {
          setState(emotion);
          setTimeout(() => setState("idle"), 2000);
        } else {
          setState("idle");
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
    addBubble(text, "user");
    setInput("");
    setState("thinking");

    try {
      const url = `${CONFIG.supabaseUrl}/functions/v1/${CONFIG.functionName}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CONFIG.supabaseKey}`,
        },
        body: JSON.stringify({ message: text, session_id: sessionIdRef.current }),
      });
      if (!response.ok) throw new Error("Erro na API");
      const data = await response.json();
      const replyText = data.response || data.text || data.reply || "";
      const emotion = data.emotion || "idle";
      addBubble(replyText, "agent");
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
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Seu navegador não suporta reconhecimento de voz. Use Chrome.");
      return;
    }
    const recognition = new SR();
    recognition.lang = CONFIG.language;
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

  return (
    <>
      <div className="status-bar">
        <div className={`status-dot ${agentState}`} />
        <span className="status-text">{STATUS_LABELS[agentState] || agentState}</span>
      </div>

      <div className="avatar-container">
        <div className={`avatar-glow ${agentState}`}>
          <video ref={videoRef} id="avatarVideo" autoPlay loop muted playsInline>
            <source src={VIDEOS.idle} type="video/mp4" />
          </video>
        </div>
      </div>

      <div className="chat-area" ref={chatAreaRef}>
        {bubbles.map((b) => (
          <div key={b.id} className={`bubble ${b.role}`}>
            {b.text}
          </div>
        ))}
      </div>

      <div className="input-area">
        <button
          className={`mic-button ${isRecording ? "recording" : ""}`}
          onClick={() => (isRecording ? stopListening() : startListening())}
          aria-label="Microfone"
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

        <button className="send-button" onClick={() => sendMessage(input)} aria-label="Enviar">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
          </svg>
        </button>
      </div>
    </>
  );
}
