// Pure, client-safe personalization tokens. No fs / node imports in here.

export type AccentKey = "cyan" | "emerald" | "violet" | "amber" | "rose" | "sky";
export type AvatarKey = "core" | "node" | "orbit" | "hex";
export type DensityKey = "comfortable" | "compact";
export type ThemeKey = "dark" | "auto";
export type AnimationKey = "full" | "reduced";
export type PrivacyKey = "offline" | "anonymous" | "local";

export interface BrandingLite {
  aiName: string;
  avatar: AvatarKey;
  accent: AccentKey;
  density: DensityKey;
  theme: ThemeKey;
  voice: string;
  model: string;
  wakeWord: string;
  animation: AnimationKey;
  defaultWorkspace: string;
  privacy: PrivacyKey;
}

export const DEFAULT_BRANDING: BrandingLite = {
  aiName: "TECHY",
  avatar: "core",
  accent: "cyan",
  density: "comfortable",
  theme: "dark",
  voice: "local",
  model: "auto",
  wakeWord: "hey techy",
  animation: "full",
  defaultWorkspace: "workspace",
  privacy: "offline",
};

export type Branding = BrandingLite & { updatedAt: string };

export const ACCENTS: Record<AccentKey, { hex: string; rgb: string; label: string }> = {
  cyan: { hex: "#22d3ee", rgb: "34, 211, 238", label: "Cyan Cloud" },
  emerald: { hex: "#34d399", rgb: "52, 211, 153", label: "Emerald Grid" },
  violet: { hex: "#a78bfa", rgb: "167, 139, 250", label: "Violet Vector" },
  amber: { hex: "#fbbf24", rgb: "251, 191, 36", label: "Amber Relay" },
  rose: { hex: "#fb7185", rgb: "251, 113, 133", label: "Rose Node" },
  sky: { hex: "#38bdf8", rgb: "56, 189, 248", label: "Sky Uplink" },
};

export const AVATARS: Record<AvatarKey, { label: string; icon: "Cpu" | "Network" | "Orbit" | "Hexagon" }> = {
  core: { label: "Core Circuit", icon: "Cpu" },
  node: { label: "Network Node", icon: "Network" },
  orbit: { label: "Orbital Eye", icon: "Orbit" },
  hex: { label: "Hex Matrix", icon: "Hexagon" },
};

export const DENSITIES: Array<{ key: DensityKey; label: string }> = [
  { key: "comfortable", label: "Comfortable" },
  { key: "compact", label: "Compact" },
];

export const THEMES: Array<{ key: ThemeKey; label: string }> = [
  { key: "dark", label: "Dark" },
  { key: "auto", label: "Auto" },
];

export const ANIMATIONS: Array<{ key: AnimationKey; label: string }> = [
  { key: "full", label: "Full motion" },
  { key: "reduced", label: "Reduced" },
];

export const PRIVACY_LEVELS: Array<{ key: PrivacyKey; label: string }> = [
  { key: "offline", label: "Strictly offline" },
  { key: "anonymous", label: "Allow anonymous help" },
  { key: "local", label: "Local only" },
];

export function brandInitial(name: string): string {
  return (name.trim()[0] ?? "T").toUpperCase();
}