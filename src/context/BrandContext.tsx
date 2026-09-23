"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ACCENTS, DEFAULT_BRANDING, type AccentKey, type BrandingLite } from "@/lib/accents";

interface BrandContextValue {
  brand: BrandingLite;
  accent: (typeof ACCENTS)[AccentKey];
  apply: (patch: Partial<BrandingLite>) => Promise<void>;
  ready: boolean;
  openCommandMode: () => void;
}

const BrandContext = createContext<BrandContextValue | undefined>(undefined);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<BrandingLite>(DEFAULT_BRANDING);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void (async () => {
        try {
          const response = await fetch("/api/branding", { cache: "no-store" });
          if (response.ok) {
            const data = (await response.json()) as { branding: BrandingLite };
            setBrand({ ...DEFAULT_BRANDING, ...data.branding });
          }
        } catch {
          // keep defaults
        } finally {
          setReady(true);
        }
      })();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const apply = useCallback(async (patch: Partial<BrandingLite>) => {
    setBrand((current) => ({ ...current, ...patch }));
    try {
      const response = await fetch("/api/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (response.ok) {
        const data = (await response.json()) as { branding: BrandingLite };
        setBrand({ ...DEFAULT_BRANDING, ...data.branding });
      }
    } catch {
      // keep local optimistic value
    }
  }, []);

  const openCommandMode = useCallback(() => {
    window.dispatchEvent(new CustomEvent("techy:command"));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.avatar = brand.avatar;
    root.dataset.accent = brand.accent;
    root.dataset.density = brand.density;
    root.dataset.theme = brand.theme;
    root.dataset.animation = brand.animation;
    document.title = `${brand.aiName} — Local AI Assistant`;
  }, [brand]);

  const accent = ACCENTS[brand.accent] ?? ACCENTS.cyan;

  return (
    <BrandContext.Provider value={{ brand, accent, apply, ready, openCommandMode }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand(): BrandContextValue {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error("useBrand must be used within a BrandProvider");
  }
  return context;
}

// re-export to keep import sites tidy
export { DEFAULT_BRANDING };
export type { AccentKey, BrandingLite };