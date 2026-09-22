"use client";

import { useState, useEffect } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    let frame = 0;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);

    frame = requestAnimationFrame(update);
    media.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", update);
    };
  }, [query]);

  return matches;
}

// Common breakpoints
export const useIsMobile = () => useMediaQuery("(max-width: 640px)");
export const useIsTablet = () => useMediaQuery("(max-width: 1024px)");
export const useIsDesktop = () => useMediaQuery("(min-width: 1025px)");
