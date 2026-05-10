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
    const standbyRef = useRef<HTMLVideoElement>(null);
    const stateRef = useRef<HTMLVideoElement>(null);
    const transitionRef = useRef<HTMLVideoElement>(null);
    const emotionRef = useRef<HTMLVideoElement>(null);
    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    // Keep standby layer running with the latest source
    useEffect(() => {
      const el = standbyRef.current;
      if (!el) return;
      const src = getVideoSrc("standby", settings);
      if (src && el.src !== src) {
        el.src = src;
        el.loop = true;
        el.muted = true;
        el.play().catch(() => {});
      }
    }, [settings]);

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
        const el = standbyRef.current;
        if (!el) return;
        const src = getVideoSrc("standby", settingsRef.current);
        if (!src) return;
        if (el.src !== src) el.src = src;
        el.loop = true;
        el.play().catch(() => {});
      },
    }));

    return (
      <div id="stage">
        <video id="layer-standby" ref={standbyRef} autoPlay loop muted playsInline />
        <video id="layer-state" ref={stateRef} muted playsInline />
        <video id="layer-transition" ref={transitionRef} muted playsInline />
        <video id="layer-emotion" ref={emotionRef} muted playsInline />
      </div>
    );
  }
);
