import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AvatarCreator } from "./AvatarCreator";
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  saveSettings,
} from "@/lib/settings";
import {
  type AgentConfig,
  agentLabel,
  newAgentId,
} from "@/lib/agents";

type Props = {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  agents: AgentConfig[];
  activeAgentId: string | null;
  onAgentsChange: (list: AgentConfig[]) => void;
  onActiveAgentChange: (id: string | null) => void;
};

const LANG_OPTIONS = ["pt-BR", "en-US", "es-ES", "fr-FR", "ja-JP"];

export function SettingsPanel({
  open, onClose, settings, onChange,
  agents, activeAgentId, onAgentsChange, onActiveAgentChange,
}: Props) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "err" | "loading">("idle");
  const [creatorOpen, setCreatorOpen] = useState(false);

  useEffect(() => { if (open) setDraft(settings); }, [open, settings]);


  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const testConnection = async () => {
    setTestStatus("loading");
    try {
      const url = `${draft.supabaseUrl}/functions/v1/${draft.functionName}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${draft.supabaseKey}` },
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
    const u = new SpeechSynthesisUtterance("Olá, esta é uma frase de teste do meu agente.");
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
      <div className={`settings-overlay ${open ? "open" : ""}`} onClick={onClose} />
      <aside className={`settings-panel ${open ? "open" : ""}`}>
        <header className="settings-header">
          <h2>Configurações</h2>
          <button className="settings-close" onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        <div className="settings-body">
          <button className="creator-launcher" onClick={() => setCreatorOpen(true)}>
            <span className="wand">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29c-.39-.39-1.02-.39-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05c.39-.39.39-1.02 0-1.41z"/>
              </svg>
            </span>
            <div className="creator-info">
              <b>✨ Avatar Creator</b>
              <span>Carregue os 18 vídeos do seu avatar</span>
            </div>
          </button>

          <section className="settings-section">
            <h3>Conexão</h3>
            <label>Supabase URL
              <input value={draft.supabaseUrl} onChange={(e) => update("supabaseUrl", e.target.value)} />
            </label>
            <label>Anon Key
              <input value={draft.supabaseKey} onChange={(e) => update("supabaseKey", e.target.value)} />
            </label>
            <label>Edge Function
              <input value={draft.functionName} onChange={(e) => update("functionName", e.target.value)} />
            </label>
            <label>Session ID
              <input value={draft.sessionId} onChange={(e) => update("sessionId", e.target.value)} />
            </label>
            <button className="btn-primary" onClick={testConnection}>
              {testStatus === "loading" ? "Testando..." : "Testar Conexão"}
              {testStatus === "ok" && <span className="check ok">✓</span>}
              {testStatus === "err" && <span className="check err">✕</span>}
            </button>
          </section>

          <section className="settings-section">
            <h3>Palco do Avatar</h3>
            <label>Atraso para voltar ao standby ({draft.standbyDelay.toFixed(1)}s)
              <input type="range" min={1} max={10} step={0.5}
                value={draft.standbyDelay}
                onChange={(e) => update("standbyDelay", parseFloat(e.target.value))} />
            </label>
            <label>Duração da transição standby ({draft.standbyTransitionDuration.toFixed(1)}s)
              <input type="range" min={0.3} max={2} step={0.1}
                value={draft.standbyTransitionDuration}
                onChange={(e) => update("standbyTransitionDuration", parseFloat(e.target.value))} />
            </label>
            <label className="toggle-row">
              <span>Iniciar em modo standby</span>
              <input type="checkbox" checked={draft.startInStandby}
                onChange={(e) => update("startInStandby", e.target.checked)} />
            </label>
          </section>

          <section className="settings-section">
            <h3>Crossfade & Loop</h3>
            <label>Duração do crossfade ({draft.crossfadeMs} ms)
              <input type="range" min={100} max={2000} step={50}
                value={draft.crossfadeMs}
                onChange={(e) => update("crossfadeMs", parseInt(e.target.value, 10))} />
            </label>
            <label>Limiar de antecipação ({draft.crossfadeThresholdMs} ms antes do fim)
              <input type="range" min={100} max={2000} step={50}
                value={draft.crossfadeThresholdMs}
                onChange={(e) => update("crossfadeThresholdMs", parseInt(e.target.value, 10))} />
            </label>
          </section>

          <section className="settings-section">
            <h3>Congelar avatar (standby)</h3>
            <label className="toggle-row">
              <span>Pausar avatar em um frame fixo</span>
              <input type="checkbox" checked={draft.standbyFreeze}
                onChange={(e) => update("standbyFreeze", e.target.checked)} />
            </label>
            <label>Tempo do frame ({draft.standbyFreezeAt.toFixed(2)}s)
              <input type="number" min={0} step={0.05}
                value={draft.standbyFreezeAt}
                disabled={!draft.standbyFreeze}
                onChange={(e) => update("standbyFreezeAt", parseFloat(e.target.value) || 0)} />
            </label>
            <small style={{ opacity: 0.7 }}>
              Quando ativo, o avatar fica parado no frame escolhido do <b>standby</b>.
              As demais animações (listening, speaking, emoções…) continuam normais.
            </small>
          </section>

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
                {voices.map((v, index) => (<option key={`${v.name}-${v.lang}-${index}`} value={v.name}>{v.name} — {v.lang}</option>))}
              </select>
            </label>
            <label className="toggle-row">
              <span>Microfone</span>
              <input type="checkbox" checked={draft.micEnabled}
                onChange={(e) => update("micEnabled", e.target.checked)} />
            </label>
            <button className="btn-ghost" onClick={testVoice}>Testar Voz</button>
          </section>

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

      <AvatarCreator
        open={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        settings={draft}
        onChange={(s) => {
          setDraft(s);
          saveSettings(s);
          onChange(s);
        }}
      />
    </>
  );
}
