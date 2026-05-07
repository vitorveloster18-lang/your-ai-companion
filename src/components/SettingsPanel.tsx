import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AvatarCreator } from "./AvatarCreator";
import {
  AVATAR_STATES,
  type AppSettings,
  type AvatarStateName,
  DEFAULT_SETTINGS,
  saveSettings,
} from "@/lib/settings";

type Props = {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
};

const LANG_OPTIONS = ["pt-BR", "en-US", "es-ES", "fr-FR", "ja-JP"];

export function SettingsPanel({ open, onClose, settings, onChange }: Props) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "err" | "loading">("idle");
  const [creatorOpen, setCreatorOpen] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const handleVideoUpload = (state: AvatarStateName, file: File) => {
    if (!file.type.includes("mp4") && !file.name.endsWith(".mp4")) {
      toast.error("Apenas arquivos .mp4");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setDraft((d) => ({
        ...d,
        videoData: { ...d.videoData, [state]: dataUrl },
      }));
      toast.success(`Vídeo ${state} carregado`);
    };
    reader.readAsDataURL(file);
  };

  const removeVideo = (state: AvatarStateName) => {
    setDraft((d) => {
      const next = { ...d.videoData };
      delete next[state];
      return { ...d, videoData: next };
    });
  };

  const testConnection = async () => {
    setTestStatus("loading");
    try {
      const url = `${draft.supabaseUrl}/functions/v1/${draft.functionName}`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${draft.supabaseKey}`,
        },
        body: JSON.stringify({ message: "hello", session_id: draft.sessionId }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      setTestStatus("ok");
      toast.success("Conexão funcionando");
    } catch (e) {
      console.error(e);
      setTestStatus("err");
      toast.error("Falha na conexão");
    }
  };

  const testVoice = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      "Olá, esta é uma frase de teste do meu agente."
    );
    u.lang = draft.voiceLang;
    u.rate = draft.speechRate;
    u.pitch = draft.speechPitch;
    const v = voices.find((x) => x.name === draft.voiceName);
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };

  const handleSave = () => {
    saveSettings(draft);
    onChange(draft);
    toast.success("Configurações salvas");
    onClose();
  };

  const handleReset = () => {
    const next = { ...DEFAULT_SETTINGS, sessionId: draft.sessionId };
    setDraft(next);
    toast.success("Restaurado para padrões");
  };

  return (
    <>
      <div
        className={`settings-overlay ${open ? "open" : ""}`}
        onClick={onClose}
      />
      <aside className={`settings-panel ${open ? "open" : ""}`}>
        <header className="settings-header">
          <h2>Configurações</h2>
          <button className="settings-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </header>

        <div className="settings-body">
          {/* SECTION 1 — CONNECTION */}
          <section className="settings-section">
            <h3>Conexão</h3>
            <label>Supabase URL
              <input value={draft.supabaseUrl}
                onChange={(e) => update("supabaseUrl", e.target.value)} />
            </label>
            <label>Anon Key
              <input value={draft.supabaseKey}
                onChange={(e) => update("supabaseKey", e.target.value)} />
            </label>
            <label>Edge Function
              <input value={draft.functionName}
                onChange={(e) => update("functionName", e.target.value)} />
            </label>
            <label>Session ID
              <input value={draft.sessionId}
                onChange={(e) => update("sessionId", e.target.value)} />
            </label>
            <button className="btn-primary" onClick={testConnection}>
              {testStatus === "loading" ? "Testando..." : "Testar Conexão"}
              {testStatus === "ok" && <span className="check ok">✓</span>}
              {testStatus === "err" && <span className="check err">✕</span>}
            </button>
          </section>

          {/* SECTION 2 — AVATAR VIDEOS */}
          <section className="settings-section">
            <h3>Vídeos do Avatar</h3>
            {AVATAR_STATES.map((state) => {
              const loaded = !!draft.videoData[state];
              return (
                <div key={state} className="video-row">
                  <div className="video-row-head">
                    <span className="state-label">{state}</span>
                    {loaded && <span className="check ok">✓</span>}
                  </div>
                  {loaded && (
                    <video
                      className="video-thumb"
                      src={draft.videoData[state]}
                      muted
                      loop
                      autoPlay
                      playsInline
                    />
                  )}
                  <div className="video-actions">
                    <input
                      type="file"
                      accept="video/mp4"
                      ref={(el) => { fileInputs.current[state] = el; }}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleVideoUpload(state, f);
                        e.target.value = "";
                      }}
                    />
                    <button className="btn-ghost"
                      onClick={() => fileInputs.current[state]?.click()}>
                      Upload
                    </button>
                    {loaded && (
                      <button className="btn-ghost danger"
                        onClick={() => removeVideo(state)}>
                        Remover
                      </button>
                    )}
                    <label className="toggle-inline">
                      <input type="checkbox"
                        checked={draft.videoLoop[state]}
                        onChange={(e) =>
                          update("videoLoop", { ...draft.videoLoop, [state]: e.target.checked })
                        } />
                      Loop
                    </label>
                  </div>
                </div>
              );
            })}
          </section>

          {/* SECTION 3 — VOICE */}
          <section className="settings-section">
            <h3>Voz</h3>
            <label className="toggle-row">
              <span>Saída de voz</span>
              <input type="checkbox" checked={draft.voiceEnabled}
                onChange={(e) => update("voiceEnabled", e.target.checked)} />
            </label>
            <label>Velocidade ({draft.speechRate.toFixed(2)})
              <input type="range" min={0.5} max={2} step={0.05}
                value={draft.speechRate}
                onChange={(e) => update("speechRate", parseFloat(e.target.value))} />
            </label>
            <label>Tom ({draft.speechPitch.toFixed(2)})
              <input type="range" min={0.5} max={2} step={0.05}
                value={draft.speechPitch}
                onChange={(e) => update("speechPitch", parseFloat(e.target.value))} />
            </label>
            <label>Idioma
              <select value={draft.voiceLang}
                onChange={(e) => update("voiceLang", e.target.value)}>
                {LANG_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label>Voz
              <select value={draft.voiceName}
                onChange={(e) => update("voiceName", e.target.value)}>
                <option value="">(padrão do navegador)</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>{v.name} — {v.lang}</option>
                ))}
              </select>
            </label>
            <label className="toggle-row">
              <span>Microfone</span>
              <input type="checkbox" checked={draft.micEnabled}
                onChange={(e) => update("micEnabled", e.target.checked)} />
            </label>
            <button className="btn-ghost" onClick={testVoice}>Testar Voz</button>
          </section>

          {/* SECTION 4 — SYNC */}
          <section className="settings-section">
            <h3>Sincronização</h3>
            <label>Atraso de pensar ({draft.thinkingDelay.toFixed(2)}s)
              <input type="range" min={0} max={3} step={0.1}
                value={draft.thinkingDelay}
                onChange={(e) => update("thinkingDelay", parseFloat(e.target.value))} />
            </label>
            <label>Duração da emoção ({draft.emotionDuration.toFixed(1)}s)
              <input type="range" min={1} max={5} step={0.1}
                value={draft.emotionDuration}
                onChange={(e) => update("emotionDuration", parseFloat(e.target.value))} />
            </label>
            <label>Retorno ao idle ({draft.idleReturnDelay.toFixed(1)}s)
              <input type="range" min={0} max={3} step={0.1}
                value={draft.idleReturnDelay}
                onChange={(e) => update("idleReturnDelay", parseFloat(e.target.value))} />
            </label>
            <label className="toggle-row">
              <span>Detectar emoção da resposta</span>
              <input type="checkbox" checked={draft.autoEmotion}
                onChange={(e) => update("autoEmotion", e.target.checked)} />
            </label>
            <label className="toggle-row">
              <span>Mostrar balões de chat</span>
              <input type="checkbox" checked={draft.showBubbles}
                onChange={(e) => update("showBubbles", e.target.checked)} />
            </label>
            <label className="toggle-row">
              <span>Mostrar indicador de status</span>
              <input type="checkbox" checked={draft.showStatus}
                onChange={(e) => update("showStatus", e.target.checked)} />
            </label>
          </section>
        </div>

        <footer className="settings-footer">
          <button className="btn-ghost" onClick={handleReset}>Padrões</button>
          <button className="btn-primary" onClick={handleSave}>Salvar</button>
        </footer>
      </aside>
    </>
  );
}
