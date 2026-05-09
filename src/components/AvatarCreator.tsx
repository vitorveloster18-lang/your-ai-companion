import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  type AppSettings,
  type VideoKey,
  type VideoCategory,
  VIDEO_LIBRARY,
  uploadAvatarVideo,
  deleteAvatarVideo,
} from "@/lib/settings";

type Props = {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
};

const TABS: { id: VideoCategory; label: string }[] = [
  { id: "loop", label: "Loops" },
  { id: "transition", label: "Transitions" },
  { id: "emotion", label: "Emotions" },
];

export function AvatarCreator({ open, onClose, settings, onChange }: Props) {
  const [tab, setTab] = useState<VideoCategory>("loop");
  const [draft, setDraft] = useState<AppSettings>(settings);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (!open) return null;

  const items = VIDEO_LIBRARY.filter((v) => v.category === tab);
  const ready = VIDEO_LIBRARY.filter((v) => !!draft.videoData[v.key]).length;
  const total = VIDEO_LIBRARY.length;

  const upload = (key: VideoKey, file: File) => {
    if (!file.type.includes("mp4") && !file.name.toLowerCase().endsWith(".mp4")) {
      toast.error("Apenas arquivos .mp4");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 25MB)");
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      setDraft((d) => ({ ...d, videoData: { ...d.videoData, [key]: r.result as string } }));
      toast.success(`Vídeo ${key} carregado`);
    };
    r.readAsDataURL(file);
  };

  const remove = (key: VideoKey) => {
    setDraft((d) => {
      const next = { ...d.videoData };
      delete next[key];
      return { ...d, videoData: next };
    });
  };

  const apply = () => {
    onChange(draft);
    toast.success("Vídeos aplicados ao avatar");
    onClose();
  };

  const pct = Math.round((ready / total) * 100);

  return (
    <div className="creator-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="creator-card">
        <header className="creator-head">
          <h2>✨ Avatar Creator</h2>
          <button className="settings-close" onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        <div className="creator-body">
          <div className="ready-bar">
            <div className="ready-bar-track"><div className="ready-bar-fill" style={{ width: `${pct}%` }} /></div>
            <span><b>{ready}</b> de {total} vídeos prontos</span>
          </div>

          <div className="tab-row">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab-pill ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="video-cards">
            {items.map((v) => {
              const data = draft.videoData[v.key];
              return (
                <div key={v.key} className={`video-card ${data ? "ready" : ""}`}>
                  <div className="video-card-head">
                    <span className="vc-emoji">{v.emoji}</span>
                    <div className="vc-meta">
                      <b>{v.label}</b>
                      <small>{v.filename}</small>
                    </div>
                    {data && <span className="check ok" title="Pronto">✓</span>}
                  </div>
                  <p className="vc-desc">{v.description}</p>
                  <p className="vc-when">📍 {v.when}</p>
                  {v.triggers && (
                    <p className="vc-triggers">
                      <b>Gatilhos:</b> {v.triggers.slice(0, 4).join(", ")}…
                    </p>
                  )}
                  {data ? (
                    <video className="vc-thumb" src={data} muted loop autoPlay playsInline />
                  ) : (
                    <div className="vc-thumb empty">sem vídeo</div>
                  )}
                  <div className="vc-actions">
                    <input
                      type="file"
                      accept="video/mp4"
                      ref={(el) => { fileRefs.current[v.key] = el; }}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) upload(v.key, f);
                        e.target.value = "";
                      }}
                    />
                    <button className="btn-ghost" onClick={() => fileRefs.current[v.key]?.click()}>
                      {data ? "Trocar" : "Upload"}
                    </button>
                    {data && (
                      <button className="btn-ghost danger" onClick={() => remove(v.key)}>
                        Remover
                      </button>
                    )}
                    <label className="toggle-inline">
                      <input
                        type="checkbox"
                        checked={draft.videoLoop[v.key]}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            videoLoop: { ...d.videoLoop, [v.key]: e.target.checked },
                          }))
                        }
                      />
                      Loop
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="creator-foot">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={apply}>
            Aplicar todos os {total} vídeos
          </button>
        </footer>
      </div>
    </div>
  );
}
