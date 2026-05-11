import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  type AppSettings,
  type VideoKey,
  type VideoCategory,
  VIDEO_LIBRARY,
  uploadAvatarVideo,
  deleteAvatarVideo,
  saveSettings,
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

  const getVariants = (key: VideoKey): string[] => {
    const v = draft.videoData[key];
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  };

  const getClip = (key: VideoKey, idx: number): { in?: number; out?: number } => {
    return draft.videoClips?.[key]?.[idx] || {};
  };

  const setClip = (key: VideoKey, idx: number, patch: { in?: number; out?: number }) => {
    setDraft((d) => {
      const arr = [...(d.videoClips?.[key] || [])];
      while (arr.length <= idx) arr.push({});
      arr[idx] = { ...arr[idx], ...patch };
      const nextClips = { ...d.videoClips, [key]: arr };
      const next = { ...d, videoClips: nextClips };
      saveSettings(next);
      onChange(next);
      return next;
    });
  };

  const setVariantMode = (key: VideoKey, mode: "round-robin" | "random") => {
    setDraft((d) => {
      const next = { ...d, variantMode: { ...d.variantMode, [key]: mode } };
      saveSettings(next);
      onChange(next);
      return next;
    });
  };

  const setVariantStart = (key: VideoKey, start: number) => {
    setDraft((d) => {
      const next = { ...d, variantStart: { ...d.variantStart, [key]: start } };
      saveSettings(next);
      onChange(next);
      return next;
    });
  };

  const upload = async (key: VideoKey, file: File, variantIndex?: number) => {
    if (!file.type.includes("mp4") && !file.name.toLowerCase().endsWith(".mp4")) {
      toast.error("Apenas arquivos .mp4");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 50MB)");
      return;
    }
    try {
      const current = getVariants(key);
      // variantIndex 1-based; if undefined => replace primary (1)
      const idx = variantIndex ?? 1;
      toast.loading(`Enviando ${key}${idx > 1 ? `.${idx}` : ""}...`, { id: `up-${key}-${idx}` });
      const url = await uploadAvatarVideo(key, file, draft.sessionId, idx);
      setDraft((d) => {
        const list = [...current];
        list[idx - 1] = url;
        const next = { ...d, videoData: { ...d.videoData, [key]: list } };
        saveSettings(next);
        onChange(next);
        return next;
      });
      toast.success(`Vídeo ${key}${idx > 1 ? `.${idx}` : ""} salvo`, { id: `up-${key}-${idx}` });
    } catch (e: any) {
      console.error(e);
      toast.error(`Falha ao enviar: ${e?.message || "erro"}`, { id: `up-${key}-${(variantIndex ?? 1)}` });
    }
  };

  const addVariant = (key: VideoKey, file: File) => {
    const next = getVariants(key).length + 1;
    return upload(key, file, next);
  };

  const removeVariant = async (key: VideoKey, variantIndex: number) => {
    try {
      await deleteAvatarVideo(key, draft.sessionId, variantIndex);
    } catch (e) { console.warn(e); }
    setDraft((d) => {
      const list = getVariants(key).filter((_, i) => i !== variantIndex - 1);
      const nextData = { ...d.videoData };
      if (list.length === 0) delete nextData[key];
      else nextData[key] = list.length === 1 ? list[0] : list;
      const updated = { ...d, videoData: nextData };
      saveSettings(updated);
      onChange(updated);
      return updated;
    });
    toast.success("Variante removida");
  };

  const remove = async (key: VideoKey) => {
    try {
      await deleteAvatarVideo(key, draft.sessionId);
    } catch (e) { console.warn(e); }
    setDraft((d) => {
      const next = { ...d.videoData };
      delete next[key];
      const updated = { ...d, videoData: next };
      saveSettings(updated);
      onChange(updated);
      return updated;
    });
    toast.success("Vídeo removido");
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
              const variants = getVariants(v.key);
              const hasAny = variants.length > 0;
              const primary = variants[0];
              return (
                <div key={v.key} className={`video-card ${hasAny ? "ready" : ""}`}>
                  <div className="video-card-head">
                    <span className="vc-emoji">{v.emoji}</span>
                    <div className="vc-meta">
                      <b>{v.label}</b>
                      <small>{v.filename}{variants.length > 1 ? ` • ${variants.length} variantes` : ""}</small>
                    </div>
                    {hasAny && <span className="check ok" title="Pronto">✓</span>}
                  </div>
                  <p className="vc-desc">{v.description}</p>
                  <p className="vc-when">📍 {v.when}</p>
                  {v.triggers && (
                    <p className="vc-triggers">
                      <b>Gatilhos:</b> {v.triggers.slice(0, 4).join(", ")}…
                    </p>
                  )}
                  {primary ? (
                    <video className="vc-thumb" src={primary} muted loop autoPlay playsInline />
                  ) : (
                    <div className="vc-thumb empty">sem vídeo</div>
                  )}

                  {variants.length > 1 && (
                    <div className="vc-variants" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {variants.map((url, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          <video src={url} muted playsInline style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />
                          <button
                            onClick={() => removeVariant(v.key, i + 1)}
                            title={`Remover variante ${i + 1}`}
                            style={{ position: "absolute", top: -6, right: -6, background: "rgba(0,0,0,0.7)", color: "#fff", border: 0, borderRadius: "50%", width: 18, height: 18, fontSize: 11, cursor: "pointer" }}
                          >×</button>
                        </div>
                      ))}
                    </div>
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
                    <input
                      type="file"
                      accept="video/mp4"
                      ref={(el) => { fileRefs.current[`${v.key}__add`] = el; }}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) addVariant(v.key, f);
                        e.target.value = "";
                      }}
                    />
                    <button className="btn-ghost" onClick={() => fileRefs.current[v.key]?.click()}>
                      {hasAny ? "Trocar" : "Upload"}
                    </button>
                    {hasAny && (
                      <button
                        className="btn-ghost"
                        onClick={() => fileRefs.current[`${v.key}__add`]?.click()}
                        title="Adicionar outra variante para evitar quebra de loop"
                      >
                        + Variante
                      </button>
                    )}
                    {hasAny && (
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
