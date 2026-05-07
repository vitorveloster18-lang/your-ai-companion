import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  AVATAR_STATES,
  type ApiProvider,
  type AppSettings,
  type AvatarStateName,
  DEFAULT_STATE_PROMPTS,
} from "@/lib/settings";

type Props = {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
};

type WizardStep = "image" | "api" | "states" | "summary";

const STATE_ICONS: Record<AvatarStateName, string> = {
  idle: "🌙",
  listening: "👂",
  thinking: "💭",
  speaking: "🗣️",
  happy: "😊",
  sad: "😢",
};

// Public Replicate model version for SVD image-to-video
const REPLICATE_SVD_VERSION =
  "3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438";

export function AvatarCreator({ open, onClose, settings, onChange }: Props) {
  const [step, setStep] = useState<WizardStep>("image");
  const [referenceImage, setReferenceImage] = useState(settings.referenceImage);
  const [apiProvider, setApiProvider] = useState<ApiProvider>(settings.apiProvider);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [customApiUrl, setCustomApiUrl] = useState(settings.customApiUrl);
  const [statePrompts, setStatePrompts] = useState({ ...settings.statePrompts });
  const [stateDurations, setStateDurations] = useState({ ...settings.stateDurations });
  const [videoLoop, setVideoLoop] = useState({ ...settings.videoLoop });
  const [generatedVideos, setGeneratedVideos] = useState<Partial<Record<AvatarStateName, string>>>(
    { ...settings.videoData }
  );
  const [approvedStates, setApprovedStates] = useState<Set<AvatarStateName>>(new Set());
  const [currentStateIdx, setCurrentStateIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const currentState = AVATAR_STATES[currentStateIdx];

  const handleImageFile = (file: File) => {
    if (!/(jpe?g|png|webp)/i.test(file.type)) {
      toast.error("Apenas JPG, PNG ou WEBP");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImage(reader.result as string);
      toast.success("Imagem carregada");
    };
    reader.readAsDataURL(file);
  };

  const saveApiSettings = () => {
    const next: AppSettings = {
      ...settings,
      apiProvider,
      apiKey,
      customApiUrl,
      referenceImage,
    };
    onChange(next);
    toast.success("Configurações de API salvas");
    setStep("states");
  };

  const callReplicate = async (prompt: string): Promise<string> => {
    if (!apiKey) throw new Error("API Key não configurada");
    if (!referenceImage) throw new Error("Imagem de referência ausente");

    const createResp = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: REPLICATE_SVD_VERSION,
        input: {
          input_image: referenceImage,
          prompt,
          num_frames: 25,
          motion_bucket_id: 127,
        },
      }),
    });

    if (!createResp.ok) {
      if (createResp.status === 402 || createResp.status === 429) {
        throw new Error("Limite da API atingido. Verifique seu plano ou troque o provedor.");
      }
      throw new Error(`Erro ${createResp.status} ao chamar a API`);
    }
    const created = await createResp.json();
    let prediction = created;
    while (prediction.status !== "succeeded" && prediction.status !== "failed") {
      await new Promise((r) => setTimeout(r, 2000));
      const poll = await fetch(prediction.urls.get, {
        headers: { Authorization: `Token ${apiKey}` },
      });
      prediction = await poll.json();
    }
    if (prediction.status === "failed") throw new Error("Geração falhou");
    const out = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (!out) throw new Error("Sem saída da API");
    return out as string;
  };

  const callCustom = async (prompt: string): Promise<string> => {
    if (!customApiUrl) throw new Error("URL personalizada vazia");
    const r = await fetch(customApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: referenceImage, prompt }),
    });
    if (!r.ok) throw new Error(`Erro ${r.status} na API personalizada`);
    const data = await r.json();
    return data.video_url || data.output || "";
  };

  const generateForCurrent = async () => {
    setGenerating(true);
    setPreviewUrl(null);
    try {
      const prompt = statePrompts[currentState];
      let url: string;
      if (apiProvider === "replicate") {
        url = await callReplicate(prompt);
      } else if (apiProvider === "custom") {
        url = await callCustom(prompt);
      } else {
        throw new Error(
          `Provedor ${apiProvider} ainda não suportado. Use Replicate ou Custom API.`
        );
      }
      setPreviewUrl(url);
      toast.success(`Vídeo de ${currentState} gerado`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Falha ao gerar vídeo");
    } finally {
      setGenerating(false);
    }
  };

  const approveAndNext = () => {
    if (!previewUrl) {
      toast.error("Gere o vídeo primeiro");
      return;
    }
    setGeneratedVideos((g) => ({ ...g, [currentState]: previewUrl }));
    setApprovedStates((s) => new Set(s).add(currentState));
    setPreviewUrl(null);
    if (currentStateIdx < AVATAR_STATES.length - 1) {
      setCurrentStateIdx((i) => i + 1);
    } else {
      setStep("summary");
    }
  };

  const applyAll = () => {
    const next: AppSettings = {
      ...settings,
      referenceImage,
      apiProvider,
      apiKey,
      customApiUrl,
      statePrompts,
      stateDurations,
      videoLoop,
      videoData: { ...settings.videoData, ...generatedVideos },
    };
    onChange(next);
    toast.success("Avatar atualizado com sucesso");
    onClose();
  };

  return (
    <div className="creator-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="creator-card">
        <header className="creator-head">
          <h2>✨ Avatar Creator</h2>
          <button className="settings-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </header>

        <div className="creator-body">
          <div className="stepper">
            {(["image", "api", "states", "summary"] as WizardStep[]).map((s) => (
              <div
                key={s}
                className={`step-pill ${step === s ? "active" : ""} ${
                  ["image", "api", "states", "summary"].indexOf(step) >
                  ["image", "api", "states", "summary"].indexOf(s)
                    ? "done"
                    : ""
                }`}
              >
                {s === "image" ? "1. Imagem" : s === "api" ? "2. API" : s === "states" ? "3. Estados" : "4. Aplicar"}
              </div>
            ))}
          </div>

          {step === "image" && (
            <>
              <label style={{ fontSize: 12, color: "#5a5e7a", fontWeight: 500 }}>
                Faça upload da imagem do seu personagem
              </label>
              <div
                className={`drop-zone ${dragging ? "dragging" : ""}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleImageFile(f);
                }}
              >
                {referenceImage ? (
                  <img src={referenceImage} alt="ref" />
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
                    <div style={{ fontWeight: 600, color: "#2a2a3e" }}>
                      Arraste uma imagem ou clique aqui
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>JPG, PNG ou WEBP</div>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </>
          )}

          {step === "api" && (
            <>
              <label>Provedor da API
                <select value={apiProvider} onChange={(e) => setApiProvider(e.target.value as ApiProvider)}>
                  <option value="replicate">Replicate (recomendado)</option>
                  <option value="did">D-ID</option>
                  <option value="stability">Stability AI</option>
                  <option value="custom">Custom API</option>
                </select>
              </label>
              <label>API Key
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="cole sua chave aqui"
                />
              </label>
              {apiProvider === "custom" && (
                <label>Endpoint personalizado
                  <input
                    type="text"
                    value={customApiUrl}
                    onChange={(e) => setCustomApiUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </label>
              )}
              <p style={{ fontSize: 11, color: "#6b6e9e", lineHeight: 1.5 }}>
                As chaves são salvas apenas no seu navegador (localStorage) e nunca compartilhadas.
              </p>
            </>
          )}

          {step === "states" && (
            <>
              <div className="progress-states">
                {AVATAR_STATES.map((s) => (
                  <span
                    key={s}
                    className={
                      approvedStates.has(s) ? "done" : s === currentState ? "active" : ""
                    }
                  >
                    {approvedStates.has(s) ? "✓" : s === currentState ? "⏳" : "○"} {s}
                  </span>
                ))}
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#2a2a3e" }}>
                {STATE_ICONS[currentState]} Estado: {currentState.toUpperCase()}
              </h3>
              <label>Prompt
                <textarea
                  value={statePrompts[currentState]}
                  onChange={(e) =>
                    setStatePrompts({ ...statePrompts, [currentState]: e.target.value })
                  }
                />
              </label>
              <label>Duração ({stateDurations[currentState].toFixed(1)}s)
                <input
                  type="range" min={1} max={10} step={0.5}
                  value={stateDurations[currentState]}
                  onChange={(e) =>
                    setStateDurations({ ...stateDurations, [currentState]: parseFloat(e.target.value) })
                  }
                />
              </label>
              <label className="toggle-row">
                <span>Loop</span>
                <input
                  type="checkbox"
                  checked={videoLoop[currentState]}
                  onChange={(e) =>
                    setVideoLoop({ ...videoLoop, [currentState]: e.target.checked })
                  }
                />
              </label>

              {previewUrl && (
                <video
                  className="state-card-preview"
                  src={previewUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                />
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  className="btn-primary"
                  onClick={generateForCurrent}
                  disabled={generating}
                >
                  {generating ? <><span className="spinner" /> Gerando...</> : previewUrl ? "Regenerar" : "Gerar Vídeo"}
                </button>
                <button
                  className="btn-ghost"
                  onClick={approveAndNext}
                  disabled={!previewUrl || generating}
                >
                  Aprovar e seguir →
                </button>
                <button
                  className="btn-ghost"
                  onClick={() =>
                    setStatePrompts({
                      ...statePrompts,
                      [currentState]: DEFAULT_STATE_PROMPTS[currentState],
                    })
                  }
                >
                  Restaurar prompt
                </button>
              </div>
            </>
          )}

          {step === "summary" && (
            <>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#2a2a3e" }}>
                Pré-visualização final
              </h3>
              <div className="summary-grid">
                {AVATAR_STATES.map((s) => (
                  <div key={s} className="summary-cell">
                    {generatedVideos[s] ? (
                      <video src={generatedVideos[s]} muted loop autoPlay playsInline />
                    ) : (
                      <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>
                        sem vídeo
                      </div>
                    )}
                    <b>{STATE_ICONS[s]} {s}</b>
                  </div>
                ))}
              </div>
              <button className="btn-primary" onClick={applyAll} style={{ width: "100%" }}>
                Aplicar tudo ao avatar
              </button>
            </>
          )}
        </div>

        <footer className="creator-foot">
          <button
            className="btn-ghost"
            onClick={() => {
              const order: WizardStep[] = ["image", "api", "states", "summary"];
              const idx = order.indexOf(step);
              if (step === "states" && currentStateIdx > 0) {
                setCurrentStateIdx((i) => i - 1);
                setPreviewUrl(null);
              } else if (idx > 0) {
                setStep(order[idx - 1]);
              }
            }}
          >
            ← Voltar
          </button>
          {step === "image" && (
            <button
              className="btn-primary"
              onClick={() => setStep("api")}
              disabled={!referenceImage}
            >
              Próximo →
            </button>
          )}
          {step === "api" && (
            <button className="btn-primary" onClick={saveApiSettings}>
              Salvar e seguir →
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
