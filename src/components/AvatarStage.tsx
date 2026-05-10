import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { type AppSettings, type VideoKey, getVideoSrc } from "@/lib/settings";

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
    const stateRef = useRef<HTMLVideoElement>(null);
    const transitionRef = useRef<HTMLVideoElement>(null);
    const emotionRef = useRef<HTMLVideoElement>(null);
    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    // Keep both standby buffers loaded with the latest source
    useEffect(() => {
      const src = getVideoSrc("standby", settings);
      if (!src) return;
      [standbyARef.current, standbyBRef.current].forEach((el) => {
        if (!el) return;
        if (el.src !== src) el.src = src;
        el.muted = true;
        el.loop = false; // we handle the loop manually with crossfade
      });
      // start A
      const a = standbyARef.current;
      if (a) { a.currentTime = 0; a.play().catch(() => {}); }
      activeStandbyRef.current = "A";
      if (standbyARef.current) standbyARef.current.style.opacity = "1";
      if (standbyBRef.current) standbyBRef.current.style.opacity = "0";
    }, [settings]);

    // Seamless crossfade: when the active buffer is ~0.5s from end, start the other from 0 and fade.
    const handleStandbyTimeUpdate = (which: "A" | "B") => {
      if (activeStandbyRef.current !== which) return;
      const cur = which === "A" ? standbyARef.current : standbyBRef.current;
      const other = which === "A" ? standbyBRef.current : standbyARef.current;
      if (!cur || !other || !cur.duration || isNaN(cur.duration)) return;
      const remaining = cur.duration - cur.currentTime;
      if (remaining < 0.5 && other.paused) {
        other.currentTime = 0;
        other.play().catch(() => {});
        // Crossfade
        other.style.opacity = "1";
        cur.style.opacity = "0";
        activeStandbyRef.current = which === "A" ? "B" : "A";
        // Pause the now-hidden buffer after fade completes
        setTimeout(() => { try { cur.pause(); } catch {} }, 600);
      }
    };

    useImperativeHandle(ref, () => ({
      showState(key, loop = true) {
        const el = stateRef.current;
        if (!el) return;
        const src = getVideoSrc(key, settingsRef.current);
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
        const src = getVideoSrc(key, settingsRef.current);
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
        // safety
        setTimeout(() => { if (el.onended) done(); }, 15000);
      },
      playEmotion(key, cb) {
        const el = emotionRef.current;
        const src = getVideoSrc(key, settingsRef.current);
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
