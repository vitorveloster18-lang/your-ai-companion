import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  type AppSettings,
  type VideoKey,
  type VariantDetail,
  VIDEO_LIBRARY,
  getVideoSrc,
  getVideoVariantsDetailed,
} from "@/lib/settings";

export type AvatarStageHandle = {
  showState: (key: VideoKey, loop?: boolean) => void;
  hideState: (cb?: () => void) => void;
  playTransition: (key: VideoKey, cb?: () => void) => void;
  playEmotion: (key: VideoKey, cb?: () => void) => void;
  setStandby: (key?: VideoKey) => void;
};

type Props = { settings: AppSettings; onStateChange?: (key: VideoKey) => void };

export const AvatarStage = forwardRef<AvatarStageHandle, Props>(
  function AvatarStage({ settings, onStateChange }, ref) {
    // Two standby buffers for seamless crossfade looping (no flash at the end)
    const standbyARef = useRef<HTMLVideoElement>(null);
    const standbyBRef = useRef<HTMLVideoElement>(null);
    const activeStandbyRef = useRef<"A" | "B">("A");
    const standbyVariantIdxRef = useRef(0);
    const standbySwapLockRef = useRef(false);

    // Round-robin counters per state for non-standby variants
    const variantCounterRef = useRef<Partial<Record<VideoKey, number>>>({});

    const stateRef = useRef<HTMLVideoElement>(null);
    const transitionRef = useRef<HTMLVideoElement>(null);
    const emotionRef = useRef<HTMLVideoElement>(null);

    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    // Apply crossfade duration CSS variable
    useEffect(() => {
      const ms = Math.max(50, settings.crossfadeMs ?? 600);
      [standbyARef, standbyBRef, stateRef, transitionRef, emotionRef].forEach((r) => {
        if (r.current) r.current.style.transitionDuration = `${ms}ms`;
      });
    }, [settings.crossfadeMs]);

    const pickVariant = (key: VideoKey, isStandby = false): VariantDetail | null => {
      const variants = getVideoVariantsDetailed(key, settingsRef.current);
      if (!variants.length) return null;
      const mode = settingsRef.current.variantMode?.[key] ?? "round-robin";
      if (mode === "random") {
        return variants[Math.floor(Math.random() * variants.length)];
      }
      // round-robin
      if (isStandby) {
        const i = standbyVariantIdxRef.current % variants.length;
        standbyVariantIdxRef.current = (i + 1) % variants.length;
        return variants[i];
      }
      const cur = variantCounterRef.current[key] ?? 0;
      const i = cur % variants.length;
      variantCounterRef.current[key] = (i + 1) % variants.length;
      return variants[i];
    };

    const getStandbyLiveVariants = (s: AppSettings): VariantDetail[] => {
      const loopKeys = VIDEO_LIBRARY
        .filter((v) => v.category === "loop")
        .map((v) => v.key);
      const orderedKeys: VideoKey[] = [
        "standby",
        ...loopKeys.filter((key) => key !== "standby"),
      ];
      return orderedKeys.flatMap((key) => getVideoVariantsDetailed(key, s));
    };

    const pickStandbyLiveVariant = (): VariantDetail | null => {
      const variants = getStandbyLiveVariants(settingsRef.current);
      if (!variants.length) return null;
      const mode = settingsRef.current.variantMode?.standby ?? "round-robin";
      if (mode === "random") return variants[Math.floor(Math.random() * variants.length)];
      const i = standbyVariantIdxRef.current % variants.length;
      standbyVariantIdxRef.current = (i + 1) % variants.length;
      return variants[i];
    };

    // Apply in/out trimming when starting a video on an element
    const startPlayback = (el: HTMLVideoElement, v: VariantDetail, opts: { loop: boolean }) => {
      el.src = v.url;
      el.loop = opts.loop && !v.out; // if out trim is set we handle ending manually
      el.muted = true;
      el.preload = "auto";
      el.dataset.outSec = v.out != null ? String(v.out) : "";
      el.dataset.inSec = v.in != null ? String(v.in) : "";
      el.dataset.nextReady = "";
      el.dataset.prepared = "";
      const apply = () => {
        try { if (typeof v.in === "number" && v.in > 0) el.currentTime = v.in; } catch {}
        el.play().catch(() => {});
      };
      if (el.readyState >= 1) apply();
      else el.addEventListener("loadedmetadata", apply, { once: true });
    };

    // ===== Standby management =====
    useEffect(() => {
      const s = settingsRef.current;
      const variants = getStandbyLiveVariants(s);
      const a = standbyARef.current;
      const b = standbyBRef.current;
      if (!a || !b) return;

      // No standby video — nothing to do
      if (!variants.length) return;

      // Initialize round-robin index from variantStart (1-based)
      const start = Math.max(1, s.variantStart?.["standby"] ?? 1);
      standbyVariantIdxRef.current = (start - 1) % variants.length;

      // FREEZE MODE — only for a single static standby clip. When multiple
      // standby variants exist, the avatar should stay "alive" by chaining them.
      if (s.standbyFreeze && variants.length <= 1) {
        const v = variants[standbyVariantIdxRef.current % variants.length];
        a.src = v.url;
        a.loop = false;
        a.muted = true;
        const freezeAt = Math.max(0, s.standbyFreezeAt ?? 0);
        const apply = () => {
          try { a.currentTime = freezeAt; } catch {}
          try { a.pause(); } catch {}
        };
        if (a.readyState >= 1) apply();
        else a.addEventListener("loadedmetadata", apply, { once: true });
        a.style.opacity = "1";
        b.style.opacity = "0";
        try { b.pause(); } catch {}
        activeStandbyRef.current = "A";
        return;
      }

      // LOOP MODE — start the first variant, advance the rr index
      const first = variants[standbyVariantIdxRef.current % variants.length];
      standbyVariantIdxRef.current = (standbyVariantIdxRef.current + 1) % variants.length;
      startPlayback(a, first, { loop: false });
      a.style.opacity = "1";
      b.style.opacity = "0";
      try { b.pause(); } catch {}
      activeStandbyRef.current = "A";
    }, [
      settings.videoData,
      settings.videoClips,
      settings.standbyFreeze,
      settings.standbyFreezeAt,
      settings.variantStart,
    ]);

    // Gapless concatenation between standby variants.
    // Returns true if a swap was performed.
    const performStandbySwap = (which: "A" | "B"): boolean => {
      const s = settingsRef.current;
      const cur = which === "A" ? standbyARef.current : standbyBRef.current;
      const other = which === "A" ? standbyBRef.current : standbyARef.current;
      if (!cur || !other) return false;
      if (standbySwapLockRef.current) return false;
      standbySwapLockRef.current = true;
      // If the hidden buffer was not explicitly prepared as the next clip,
      // load a fresh variant instead of swapping back to an ended/old frame.
      if (other.dataset.prepared !== "1") {
        const next = pickStandbyLiveVariant();
        if (!next) { standbySwapLockRef.current = false; return false; }
        other.src = next.url;
        other.loop = false;
        other.muted = true;
        other.preload = "auto";
        other.dataset.outSec = next.out != null ? String(next.out) : "";
        other.dataset.inSec = next.in != null ? String(next.in) : "";
        other.dataset.nextReady = "";
        other.dataset.prepared = "1";
        const setStart = () => {
          try { other.currentTime = next.in && next.in > 0 ? next.in : 0; } catch {}
        };
        if (other.readyState >= 1) setStart();
        else other.addEventListener("loadedmetadata", setStart, { once: true });
      }
      // Instant hard-swap (no fade) for true gapless continuity
      other.style.transition = "none";
      cur.style.transition = "none";
      other.style.opacity = "1";
      cur.style.opacity = "0";
      other.play().catch(() => {});
      activeStandbyRef.current = which === "A" ? "B" : "A";
      // Clear flags so the next cycle preloads again
      cur.dataset.nextReady = "";
      other.dataset.nextReady = "";
      cur.dataset.prepared = "";
      other.dataset.prepared = "";
      setTimeout(() => {
        try { cur.pause(); } catch {}
        try { cur.currentTime = 0; } catch {}
        cur.removeAttribute("src");
        try { cur.load(); } catch {}
        // Restore transition for future crossfades on state/emotion layers
        const ms = Math.max(50, s.crossfadeMs ?? 600);
        cur.style.transition = `opacity ${ms}ms ease`;
        other.style.transition = `opacity ${ms}ms ease`;
        standbySwapLockRef.current = false;
      }, 30);
      return true;
    };

    const handleStandbyTimeUpdate = (which: "A" | "B") => {
      const s = settingsRef.current;
      if (s.standbyFreeze && getStandbyLiveVariants(s).length <= 1) return;
      if (activeStandbyRef.current !== which) return;
      const cur = which === "A" ? standbyARef.current : standbyBRef.current;
      const other = which === "A" ? standbyBRef.current : standbyARef.current;
      if (!cur || !other || !cur.duration || isNaN(cur.duration)) return;

      const outAttr = cur.dataset.outSec ? parseFloat(cur.dataset.outSec) : NaN;
      const effectiveEnd = isFinite(outAttr) && outAttr > 0 ? outAttr : cur.duration;
      const remaining = effectiveEnd - cur.currentTime;

      // 1) Preload next variant well before the end (buffered, paused, hidden)
      const preloadAt = Math.max(0.6, (s.crossfadeThresholdMs ?? 600) / 1000);
      if (remaining < preloadAt && cur.dataset.nextReady !== "1") {
        const next = pickStandbyLiveVariant();
        if (!next) return;
        cur.dataset.nextReady = "1";
        other.src = next.url;
        other.loop = false;
        other.muted = true;
        other.preload = "auto";
        other.style.transition = "none";
        other.style.opacity = "0";
        other.dataset.outSec = next.out != null ? String(next.out) : "";
        other.dataset.inSec = next.in != null ? String(next.in) : "";
        other.dataset.prepared = "1";
        other.dataset.nextReady = "";
        const prep = () => {
          try { other.currentTime = next.in && next.in > 0 ? next.in : 0; } catch {}
          try { other.pause(); } catch {}
        };
        if (other.readyState >= 2) prep();
        else other.addEventListener("loadeddata", prep, { once: true });
      }

      // 2) At the very end, hard-swap: play other, hide current instantly
      if (remaining <= 0.08) {
        performStandbySwap(which);
      }
    };

    // Fallback: if timeupdate misses the swap window, the `ended` event recovers
    const handleStandbyEnded = (which: "A" | "B") => {
      const s = settingsRef.current;
      if (s.standbyFreeze && getStandbyLiveVariants(s).length <= 1) return;
      if (activeStandbyRef.current !== which) return;
      performStandbySwap(which);
    };

    // Safety net: some mobile browsers pause or miss `timeupdate`/`ended` on
    // dynamically swapped videos. Keep the visible standby buffer alive.
    useEffect(() => {
      if (settings.standbyFreeze && getStandbyLiveVariants(settingsRef.current).length <= 1) return;
      const timer = window.setInterval(() => {
        const which = activeStandbyRef.current;
        const el = which === "A" ? standbyARef.current : standbyBRef.current;
        if (!el) return;
        if (!getStandbyLiveVariants(settingsRef.current).length) return;

        if (!el.src) {
          const v = pickStandbyLiveVariant();
          if (v) {
            startPlayback(el, v, { loop: false });
            el.style.opacity = "1";
          }
          return;
        }

        const outAttr = el.dataset.outSec ? parseFloat(el.dataset.outSec) : NaN;
        const effectiveEnd = isFinite(outAttr) && outAttr > 0 ? outAttr : el.duration;
        if (el.ended || (isFinite(effectiveEnd) && effectiveEnd > 0 && el.currentTime >= effectiveEnd - 0.04)) {
          performStandbySwap(which);
          return;
        }

        if (el.paused && el.readyState >= 2) {
          el.play().catch(() => {});
          return;
        }

        const last = parseFloat(el.dataset.lastTime || "-1");
        const stillTicks = parseInt(el.dataset.stillTicks || "0", 10);
        if (!el.paused && el.readyState >= 2 && Math.abs(el.currentTime - last) < 0.01) {
          const nextTicks = stillTicks + 1;
          el.dataset.stillTicks = String(nextTicks);
          if (nextTicks >= 5) performStandbySwap(which);
        } else {
          el.dataset.stillTicks = "0";
        }
        el.dataset.lastTime = String(el.currentTime);
      }, 250);
      return () => window.clearInterval(timer);
    }, [settings.videoData, settings.videoClips, settings.standbyFreeze]);

    // For state/transition/emotion: monitor time vs "out" trim and end the clip early
    const watchTrim = (el: HTMLVideoElement, v: VariantDetail, onEnd: () => void) => {
      if (v.out == null || v.out <= 0) return;
      const tick = () => {
        if (el.currentTime >= (v.out as number)) {
          el.removeEventListener("timeupdate", tick);
          onEnd();
        }
      };
      el.addEventListener("timeupdate", tick);
    };

    useImperativeHandle(ref, () => ({
      showState(key, loop = true) {
        const el = stateRef.current;
        if (!el) return;
        const v = pickVariant(key);
        if (!v) return;
        startPlayback(el, v, { loop });
        el.style.opacity = "1";
        onStateChange?.(key);
      },
      hideState(cb) {
        const el = stateRef.current;
        const ms = Math.max(50, settingsRef.current.crossfadeMs ?? 600);
        if (!el) { cb?.(); return; }
        el.style.opacity = "0";
        setTimeout(() => { try { el.pause(); } catch {} cb?.(); }, ms);
      },
      playTransition(key, cb) {
        const el = transitionRef.current;
        const v = pickVariant(key);
        if (!el || !v) { cb?.(); return; }
        startPlayback(el, v, { loop: false });
        el.style.opacity = "1";
        onStateChange?.(key);
        const ms = Math.max(50, settingsRef.current.crossfadeMs ?? 600);
        const done = () => {
          el.onended = null;
          el.style.opacity = "0";
          setTimeout(() => { try { el.pause(); } catch {} cb?.(); }, ms);
        };
        el.onended = done;
        watchTrim(el, v, done);
        setTimeout(() => { if (el.onended) done(); }, 15000);
      },
      playEmotion(key, cb) {
        const el = emotionRef.current;
        const v = pickVariant(key);
        if (!el || !v) { cb?.(); return; }
        startPlayback(el, v, { loop: false });
        el.style.opacity = "1";
        const ms = Math.max(50, settingsRef.current.crossfadeMs ?? 600);
        const done = () => {
          el.onended = null;
          el.style.opacity = "0";
          setTimeout(() => { try { el.pause(); } catch {} cb?.(); }, ms);
        };
        el.onended = done;
        watchTrim(el, v, done);
        setTimeout(() => { if (el.onended) done(); }, 15000);
      },
      setStandby(_key) {
        const a = standbyARef.current;
        const src = getVideoSrc("standby", settingsRef.current);
        if (!a || !src) return;
        if (a.src !== src) a.src = src;
        a.play().catch(() => {});
      },
    }));

    return (
      <div id="stage">
        <video
          id="layer-standby"
          ref={standbyARef}
          autoPlay muted playsInline
          onTimeUpdate={() => handleStandbyTimeUpdate("A")}
          onEnded={() => handleStandbyEnded("A")}
        />
        <video
          id="layer-standby-b"
          ref={standbyBRef}
          muted playsInline
          onTimeUpdate={() => handleStandbyTimeUpdate("B")}
          onEnded={() => handleStandbyEnded("B")}
        />
        <video id="layer-state" ref={stateRef} muted playsInline />
        <video id="layer-transition" ref={transitionRef} muted playsInline />
        <video id="layer-emotion" ref={emotionRef} muted playsInline />
      </div>
    );
  }
);
