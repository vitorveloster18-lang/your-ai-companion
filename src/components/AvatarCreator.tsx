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
    const next = { ...draft, standbyFreeze: false };
    saveSettings(next);
    setDraft(next);
    onChange(next);
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

                  {hasAny && (
                    <div className="vc-variants-grid" style={{ display: "grid", gap: 8, marginTop: 8 }}>
                      {variants.map((url, i) => {
                        const clip = getClip(v.key, i);
                        return (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: 6, background: "rgba(0,0,0,0.04)", borderRadius: 8 }}>
                            <div style={{ position: "relative", flex: "0 0 auto" }}>
                              <video src={url} muted playsInline style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                              <span style={{ position: "absolute", bottom: 2, left: 2, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, padding: "1px 4px", borderRadius: 3 }}>#{i + 1}</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, flex: 1, fontSize: 12 }}>
                              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ opacity: 0.7 }}>In (s)</span>
                                <input
                                  type="number" min={0} step={0.05}
                                  value={clip.in ?? ""}
                                  placeholder="0"
                                  onChange={(e) => setClip(v.key, i, { in: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                                  style={{ width: "100%" }}
                                />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ opacity: 0.7 }}>Out (s)</span>
                                <input
                                  type="number" min={0} step={0.05}
                                  value={clip.out ?? ""}
                                  placeholder="fim"
                                  onChange={(e) => setClip(v.key, i, { out: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                                  style={{ width: "100%" }}
                                />
                              </label>
                            </div>
                            {variants.length > 1 && (
                              <button
                                onClick={() => removeVariant(v.key, i + 1)}
                                title={`Remover variante ${i + 1}`}
                                style={{ background: "rgba(0,0,0,0.7)", color: "#fff", border: 0, borderRadius: "50%", width: 22, height: 22, fontSize: 12, cursor: "pointer", flex: "0 0 auto" }}
                              >×</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {variants.length > 1 && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, fontSize: 12, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        Modo:
                        <select
                          value={draft.variantMode?.[v.key] ?? "round-robin"}
                          onChange={(e) => setVariantMode(v.key, e.target.value as "round-robin" | "random")}
                        >
                          <option value="round-robin">Round-robin</option>
                          <option value="random">Aleatório</option>
                        </select>
                      </label>
                      <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        Iniciar em:
                        <select
                          value={draft.variantStart?.[v.key] ?? 1}
                          onChange={(e) => setVariantStart(v.key, parseInt(e.target.value, 10))}
                        >
                          {variants.map((_, i) => (
                            <option key={i} value={i + 1}>#{i + 1}</option>
                          ))}
                        </select>
                      </label>
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
