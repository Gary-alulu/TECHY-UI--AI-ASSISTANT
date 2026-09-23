"use client";

import React, { useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { HUDButton } from "../ui/HUDButton";
import { Loader2, UserRound, Palette, SlidersHorizontal, Cpu, Mic, Sparkles, FolderKanban, Lock, Check, Cpu as CpuIcon, Network, Orbit, Hexagon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENTS, AVATARS, DENSITIES, THEMES, ANIMATIONS, PRIVACY_LEVELS, type AccentKey, type AvatarKey, type BrandingLite, type DensityKey, type ThemeKey, type AnimationKey, type PrivacyKey } from "@/lib/accents";
import { useBrand } from "@/context/BrandContext";

const AVATAR_ICONS = { Cpu: CpuIcon, Network, Orbit, Hexagon } as const;

export function PersonalizationPanel() {
  const { brand, apply, ready } = useBrand();
  const [draft, setDraft] = useState<BrandingLite>(brand);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDraft(brand));
    return () => cancelAnimationFrame(frame);
  }, [brand]);

  const patch = async (update: Partial<BrandingLite>) => {
    if (!ready) return;
    setSaving(true);
    setSaved(false);
    await apply(update);
    setSaving(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-mono text-slate-500">Changes apply instantly and are saved locally under <span className="text-cyan-400/70">data/branding.json</span>.</p>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1"><Check size={11} /> saved</span>}
          {saving && <Loader2 size={13} className="animate-spin text-cyan-400" />}
        </div>
      </div>

      <GlassPanel header="Identity" hudCorners>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2"><UserRound size={11} /> AI Name</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft.aiName}
                maxLength={24}
                onChange={(event) => setDraft((d) => ({ ...d, aiName: event.target.value }))}
                onBlur={() => patch({ aiName: draft.aiName })}
                className="w-full bg-navy-950/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500/50"
              />
              <HUDButton variant="outline" size="sm" onClick={() => patch({ aiName: draft.aiName })}>
                <Check size={12} /> Apply
              </HUDButton>
            </div>
            <p className="text-[10px] text-slate-600 mt-1">Used across the sidebar, chat, greeting and window title.</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2"><Sparkles size={11} /> Avatar</label>
            <div className="flex gap-2">
              {((Object.keys(AVATARS) as AvatarKey[])).map((key) => {
                const Icon = AVATAR_ICONS[AVATARS[key].icon];
                const active = draft.avatar === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => patch({ avatar: key })}
                    title={AVATARS[key].label}
                    className={cn(
                      "w-11 h-11 rounded-lg border flex items-center justify-center transition-all",
                      active ? "bg-cyan-950/40 border-cyan-400/50 text-cyan-300 scale-105" : "border-slate-700/50 text-slate-500 hover:text-slate-300"
                    )}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel header="Appearance" hudCorners>
        <div className="space-y-5">
          <div>
            <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2"><Palette size={11} /> Accent Color</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ACCENTS) as AccentKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => patch({ accent: key })}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-mono transition-all",
                    draft.accent === key ? "border-slate-400 text-slate-100" : "border-slate-700/50 text-slate-500 hover:text-slate-300"
                  )}
                  style={draft.accent === key ? { boxShadow: `0 0 0 1px ${ACCENTS[key].hex}, 0 0 18px ${ACCENTS[key].hex}55` } : undefined}
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ACCENTS[key].hex }} />
                  {ACCENTS[key].label}
                  {draft.accent === key && <Check size={11} className="text-emerald-400" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 block">Density</label>
              <select
                value={draft.density}
                onChange={(event) => patch({ density: event.target.value as DensityKey })}
                className="w-full bg-navy-950/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
              >
                {DENSITIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 block">Theme</label>
              <select
                value={draft.theme}
                onChange={(event) => patch({ theme: event.target.value as ThemeKey })}
                className="w-full bg-navy-950/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
              >
                {THEMES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 block">Motion</label>
              <select
                value={draft.animation}
                onChange={(event) => patch({ animation: event.target.value as AnimationKey })}
                className="w-full bg-navy-950/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
              >
                {ANIMATIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel header="Intelligence" hudCorners>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2"><Cpu size={11} /> Default Model</label>
            <input
              type="text"
              value={draft.model}
              placeholder="auto — first local model"
              onChange={(event) => setDraft((d) => ({ ...d, model: event.target.value }))}
              onBlur={() => patch({ model: draft.model })}
              className="w-full bg-navy-950/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500/50"
            />
            <p className="text-[10px] text-slate-600 mt-1">Named model wins when Ollama has it; “auto” picks the first available.</p>
          </div>
          <div>
            <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2"><Mic size={11} /> Voice</label>
            <select
              value={draft.voice}
              onChange={(event) => patch({ voice: event.target.value })}
              className="w-full bg-navy-950/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
            >
              <option value="local">Local voice</option>
              <option value="system">System default</option>
              <option value="web">Web voices</option>
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2"><SlidersHorizontal size={11} /> Wake Word</label>
            <input
              type="text"
              value={draft.wakeWord}
              onChange={(event) => setDraft((d) => ({ ...d, wakeWord: event.target.value }))}
              onBlur={() => patch({ wakeWord: draft.wakeWord })}
              className="w-full bg-navy-950/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2"><FolderKanban size={11} /> Default Workspace</label>
            <select
              value={draft.defaultWorkspace}
              onChange={(event) => patch({ defaultWorkspace: event.target.value })}
              className="w-full bg-navy-950/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
            >
              <option value="workspace">Project workspace</option>
              <option value="home">Home folder</option>
              <option value="matches">Match last used</option>
            </select>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel header="Privacy" hudCorners>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock size={14} className="text-emerald-400" />
            <div>
              <p className="text-xs text-slate-200">Data handling</p>
              <p className="text-[10px] text-slate-600">TECHY is local-first: memory, files and knowledge stay on this machine.</p>
            </div>
          </div>
          <select
            value={draft.privacy}
            onChange={(event) => patch({ privacy: event.target.value as PrivacyKey })}
            className="bg-navy-950/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
          >
            {PRIVACY_LEVELS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </div>
      </GlassPanel>
    </div>
  );
}