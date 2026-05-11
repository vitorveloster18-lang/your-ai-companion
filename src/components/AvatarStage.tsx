import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { type AppSettings, type VideoKey, getVideoSrc, getVideoVariants } from "@/lib/settings";

export type AvatarStageHandle = {
  showState: (key: VideoKey, loop?: boolean) => void;
  hideState: (cb?: () => void) => void;
  playTransition: (key: VideoKey, cb?: () => void) => void;
  playEmotion: (key: VideoKey, cb?: () => void) => void;
  setStandby: (key?: VideoKey) => void;
};

type Props = { settings: AppSettings; onStateChange?: (key: VideoKey) => void };

function pickRandom<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export const AvatarStage = forwardRef<AvatarStageHandle, Props>(
  function AvatarStage({ settings, onStateChange }, ref) {
    // Two standby buffers for seamless crossfade looping (no flash at the end)
    const standbyARef = useRef<HTMLVideoElement>(null);
    const standbyBRef = useRef<HTMLVideoElement>(null);
    const activeStandbyRef = useRef<"A" | "B">("A");
    // Cycle through standby variants instead of repeating the same clip
    const standbyVariantIndexRef = useRef(0);
    const stateRef = useRef<HTMLVideoElement>(null);
    const transitionRef = useRef<HTMLVideoElement>(null);
    const emotionRef = useRef<HTMLVideoElement>(null);
    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    // Pick the next standby variant URL, advancing the index (round-robin).
    const nextStandbyVariant = (): string | null => {
      const variants = getVideoVariants("standby", settingsRef.current);
      if (!variants.length) return null;
      const i = standbyVariantIndexRef.current % variants.length;
      standbyVariantIndexRef.current = (i + 1) % variants.length;
      return variants[i];
    };

    // Initialize both standby buffers with the first variant
    useEffect(() => {
      const variants = getVideoVariants("standby", settings);
      if (!variants.length) return;
      standbyVariantIndexRef.current = 0;
      const firstSrc = nextStandbyVariant(); // advances to 1
      const a = standbyARef.current;
      const b = standbyBRef.current;
      if (a && firstSrc) {
        if (a.src !== firstSrc) a.src = firstSrc;
        a.muted = true; a.loop = false;
        a.currentTime = 0;
        a.play().catch(() => {});
        a.style.opacity = "1";
      }
      if (b) {
        b.muted = true; b.loop = false;
        b.style.opacity = "0";
      }
      activeStandbyRef.current = "A";
    }, [settings]);

    // Seamless crossfade: when active buffer is ~0.5s from end, start the OTHER
    // buffer with the NEXT variant from 0 and crossfade. With multiple variants
    // this hides any visible loop seam.
    const handleStandbyTimeUpdate = (which: "A" | "B") => {
      if (activeStandbyRef.current !== which) return;
      const cur = which === "A" ? standbyARef.current : standbyBRef.current;
      const other = which === "A" ? standbyBRef.current : standbyARef.current;
      if (!cur || !other || !cur.duration || isNaN(cur.duration)) return;
      const remaining = cur.duration - cur.currentTime;
      if (remaining < 0.6 && other.paused) {
        const nextSrc = nextStandbyVariant();
        if (!nextSrc) return;
        if (other.src !== nextSrc) other.src = nextSrc;
        other.currentTime = 0;
        other.play().catch(() => {});
        other.style.opacity = "1";
        cur.style.opacity = "0";
        activeStandbyRef.current = which === "A" ? "B" : "A";
        setTimeout(() => { try { cur.pause(); } catch {} }, 700);
      }
    };

    useImperativeHandle(ref, () => ({
      showState(key, loop = true) {
        const el = stateRef.current;
        if (!el) return;
        const variants = getVideoVariants(key, settingsRef.current);
        const src = pickRandom(variants);
        if (!src) return;
        el.src = src;
        el.loop = loop;
        el.muted = true;
        el.play().catch(() => {});
        el.style.opacity = "1";
        onStateChange?.(key);
      },
      hideState(cb) {
        const el = stateRef.current;
        if (!el) { cb?.(); return; }
        el.style.opacity = "0";
        setTimeout(() => { try { el.pause(); } catch {} cb?.(); }, 500);
      },
      playTransition(key, cb) {
        const el = transitionRef.current;
        const src = pickRandom(getVideoVariants(key, settingsRef.current));
        if (!el || !src) { cb?.(); return; }
        el.src = src;
        el.loop = false;
        el.muted = true;
        el.play().catch(() => {});
        el.style.opacity = "1";
        onStateChange?.(key);
        const done = () => {
          el.onended = null;
          el.style.opacity = "0";
          setTimeout(() => { try { el.pause(); } catch {} cb?.(); }, 500);
        };
        el.onended = done;
        setTimeout(() => { if (el.onended) done(); }, 15000);
      },
      playEmotion(key, cb) {
        const el = emotionRef.current;
        const src = pickRandom(getVideoVariants(key, settingsRef.current));
        if (!el || !src) { cb?.(); return; }
        el.src = src;
        el.loop = false;
        el.muted = true;
        el.play().catch(() => {});
        el.style.opacity = "1";
        const done = () => {
          el.onended = null;
          el.style.opacity = "0";
          setTimeout(() => { try { el.pause(); } catch {} cb?.(); }, 500);
        };
        el.onended = done;
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
        />
        <video
          id="layer-standby-b"
          ref={standbyBRef}
          muted playsInline
          onTimeUpdate={() => handleStandbyTimeUpdate("B")}
        />
        <video id="layer-state" ref={stateRef} muted playsInline />
        <video id="layer-transition" ref={transitionRef} muted playsInline />
        <video id="layer-emotion" ref={emotionRef} muted playsInline />
      </div>
    );
  }
);
