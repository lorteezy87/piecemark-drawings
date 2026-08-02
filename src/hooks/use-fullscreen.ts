import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * Fullscreen for viewers.
 * Tries the native Fullscreen API first; when blocked by Permissions-Policy
 * (common in embedded previews / iframes), falls back to a fixed "immersive"
 * overlay that fills the preview viewport.
 */
export function useFullscreen(targetRef: RefObject<HTMLElement | null>) {
  const [isNative, setIsNative] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);

  const isFullscreen = isNative || isImmersive;

  const clearImmersive = useCallback(() => {
    const el = targetRef.current;
    if (el) {
      el.classList.remove("piecemark-immersive");
      el.style.removeProperty("position");
      el.style.removeProperty("inset");
      el.style.removeProperty("width");
      el.style.removeProperty("height");
      el.style.removeProperty("z-index");
      el.style.removeProperty("max-height");
      el.style.removeProperty("border-radius");
    }
    setIsImmersive(false);
  }, [targetRef]);

  const enterImmersive = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    el.classList.add("piecemark-immersive");
    el.style.position = "fixed";
    el.style.inset = "0";
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.zIndex = "9999";
    el.style.maxHeight = "none";
    el.style.borderRadius = "0";
    setIsImmersive(true);
  }, [targetRef]);

  useEffect(() => {
    const onChange = () => {
      const el = targetRef.current;
      const active = !!el && document.fullscreenElement === el;
      setIsNative(active);
      if (active) clearImmersive();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [targetRef, clearImmersive]);

  useEffect(() => {
    if (!isImmersive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        clearImmersive();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isImmersive, clearImmersive]);

  const toggle = useCallback(async () => {
    const el = targetRef.current;
    if (!el) return;

    // Exit immersive first
    if (isImmersive) {
      clearImmersive();
      return;
    }

    // Exit native fullscreen
    if (document.fullscreenElement === el) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
      setIsNative(false);
      return;
    }

    // Try native; fall back to immersive when policy blocks it
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      if (typeof el.requestFullscreen === "function") {
        await el.requestFullscreen();
        setIsNative(true);
        return;
      }
    } catch {
      // Permissions-Policy: fullscreen not allowed in iframe — expected in preview
    }
    enterImmersive();
  }, [targetRef, isImmersive, clearImmersive, enterImmersive]);

  return { isFullscreen, toggle, isImmersive };
}
