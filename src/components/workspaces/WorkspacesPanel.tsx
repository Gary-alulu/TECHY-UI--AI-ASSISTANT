"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  AlertCircle,
  LayoutPanelLeft,
  Loader2,
  Monitor,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { DisplayInfo, SlotPosition, WorkspaceLayout, WorkspaceSlot } from "@/types";

const POSITIONS: Array<{ key: SlotPosition; label: string }> = [
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
  { key: "secondary", label: "Secondary" },
  { key: "bottom", label: "Bottom" },
  { key: "overlay", label: "Overlay" },
];

interface DraftSlot {
  id: string;
  appName: string;
  position: SlotPosition;
  display: string;
}

export function WorkspacesPanel() {
  const { accent } = useBrand();
  const [workspaces, setWorkspaces] = useState<WorkspaceLayout[]>([]);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slots, setSlots] = useState<DraftSlot[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [wsResponse, displayResponse] = await Promise.all([
        fetch("/api/workspaces", { cache: "no-store" }),
        fetch("/api/devices", { cache: "no-store" }),
      ]);
      if (!wsResponse.ok) throw new Error(`Failed (${wsResponse.status})`);
      const wsData = (await wsResponse.json()) as { workspaces: WorkspaceLayout[] };
      setWorkspaces(wsData.workspaces);
      const deviceData = (await displayResponse.json()) as { displays: DisplayInfo[] };
      setDisplays(deviceData.displays);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load workspaces");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void refresh());
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

  const addSlot = useCallback(() => {
    setSlots((current) => [
      ...current,
      { id: `slot-${Date.now()}`, appName: "", position: "left", display: displays[0]?.label ?? "Main work" },
    ]);
  }, [displays]);

  const updateSlot = useCallback((id: string, patch: Partial<DraftSlot>) => {
    setSlots((current) => current.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));
  }, []);

  const create = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setCreating(true);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || undefined,
          slots: slots
            .filter((slot) => slot.appName.trim())
            .map((slot): WorkspaceSlot => ({
              id: slot.id,
              appName: slot.appName.trim(),
              position: slot.position,
              display: slot.display,
            })),
        }),
      });
      if (response.status === 201) {
        await refresh();
        setName("");
        setDescription("");
        setSlots([]);
      } else {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not create workspace");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create workspace");
    } finally {
      setCreating(false);
    }
  }, [name, description, slots, refresh]);

  const apply = useCallback(async (id: string) => {
    setApplying(id);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${id}/apply`, { method: "POST", cache: "no-store" });
      const data = (await response.json()) as { failures?: number; results?: Array<{ app: string; ok: boolean; error?: string }> };
      if (!response.ok || (data.failures ?? 0) > 0) {
        const failed = (data.results ?? []).filter((result) => !result.ok);
        setError(failed.length > 0 ? `Launched ${(data.results ?? []).length - failed.length}/${(data.results ?? []).length}: ${failed[0]?.app} — ${failed[0]?.error ?? "not found"}` : `Apply failed (${response.status})`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply workspace");
    } finally {
      setApplying(null);
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
    setWorkspaces((current) => current.filter((workspace) => workspace.id !== id));
  }, []);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      {/* Builder */}
      <GlassPanel className="xl:col-span-2 p-5 flex flex-col gap-4 border-cyan-400/20 h-fit xl:sticky xl:top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy-950 border flex items-center justify-center" style={{ borderColor: `${accent.hex}4d`, color: accent.hex, boxShadow: `0 0 16px ${accent.hex}33` }}>
            <LayoutPanelLeft size={17} />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent.hex }}>Workspace builder</div>
            <h3 className="font-display font-medium text-slate-100 text-lg tracking-wide">New workspace</h3>
          </div>
        </div>

        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          Name *
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Design review"
            className="mt-1 w-full rounded-lg bg-navy-950/70 border border-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50" />
        </label>
        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          Description
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Figma + VS Code + browser"
            className="mt-1 w-full rounded-lg bg-navy-950/70 border border-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50" />
        </label>

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Windows ({slots.length})</span>
          <HUDButton variant="outline" size="sm" className="text-slate-400" onClick={addSlot}>
            <Plus size={12} className="mr-1" /> Add window
          </HUDButton>
        </div>

        <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
          {slots.length === 0 && (
            <p className="text-[11px] text-slate-600">Add the apps for this workspace, then TECHY will position them for you when you press Launch.</p>
          )}
          {slots.map((slot, index) => (
            <div key={slot.id} className="rounded-lg bg-navy-950/50 border border-slate-800/70 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                <input
                  value={slot.appName}
                  onChange={(event) => updateSlot(slot.id, { appName: event.target.value })}
                  placeholder="App name (e.g. Figma)"
                  className="flex-1 min-w-0 rounded-md bg-navy-950/70 border border-slate-800 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50"
                />
                <HUDButton variant="ghost" size="sm" className="text-slate-500" onClick={() => setSlots((current) => current.filter((item) => item.id !== slot.id))}>
                  <X size={12} />
                </HUDButton>
              </div>
              <div className="flex gap-2">
                <select value={slot.position} onChange={(event) => updateSlot(slot.id, { position: event.target.value as SlotPosition })}
                  className="rounded-md bg-navy-950/70 border border-slate-800 px-2 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-400/50">
                  {POSITIONS.map((position) => (
                    <option key={position.key} value={position.key}>{position.label}</option>
                  ))}
                </select>
                <select value={slot.display} onChange={(event) => updateSlot(slot.id, { display: event.target.value })}
                  className="flex-1 rounded-md bg-navy-950/70 border border-slate-800 px-2 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-400/50">
                  {(displays.length > 0 ? displays : [{ id: "primary", label: "Main work", name: "Main" }]).map((display) => (
                    <option key={display.id} value={display.label ?? display.name}>{display.label ?? display.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        <HUDButton variant="default" onClick={() => void create()} disabled={!name.trim() || creating}>
          {creating ? <Loader2 size={13} className="animate-spin mr-2" /> : <Plus size={13} className="mr-2" />}
          Save workspace
        </HUDButton>

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-400/20 bg-amber-950/15 text-xs text-amber-300">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span className="min-w-0">{error}</span>
          </div>
        )}
      </GlassPanel>

      {/* List */}
      <div className="xl:col-span-3 flex flex-col gap-4">
        {loading && (
          <GlassPanel className="p-8 flex items-center justify-center text-slate-500">
            <Loader2 size={20} className="animate-spin text-cyan-400 mr-3" />
            <span className="font-mono text-xs">Loading workspaces…</span>
          </GlassPanel>
        )}

        {!loading && workspaces.length === 0 && (
          <GlassPanel className="p-8 flex flex-col items-center justify-center gap-2 text-center text-slate-600">
            <div className="w-14 h-14 rounded-xl bg-navy-950 border border-slate-800 flex items-center justify-center">
              <Monitor size={22} />
            </div>
            <p className="font-mono text-xs">No workspaces yet</p>
            <p className="text-[11px] text-slate-600 max-w-sm">Build your first one on the left — TECHY will open every app and position it across your displays.</p>
          </GlassPanel>
        )}

        {workspaces.map((workspace) => (
          <GlassPanel key={workspace.id} className="p-5 flex flex-col gap-3 border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display font-medium text-slate-100 tracking-wide truncate">{workspace.name}</div>
                {workspace.description && <div className="text-xs text-slate-500 mt-0.5">{workspace.description}</div>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <HUDButton variant="outline" size="sm" className="text-cyan-300 border-cyan-400/30" onClick={() => void apply(workspace.id)} disabled={applying === workspace.id}>
                  {applying === workspace.id ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Play size={12} className="mr-1.5" />}
                  {applying === workspace.id ? "Launching…" : "Launch"}
                </HUDButton>
                <HUDButton variant="ghost" size="sm" className="text-red-400" onClick={() => void remove(workspace.id)} title="Delete">
                  <Trash2 size={14} />
                </HUDButton>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {workspace.slots.map((slot) => (
                <div key={slot.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-navy-950/60 border border-slate-800/70">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: slot.display.includes("Main") ? accent.hex : "#8b5cf6" }}
                    title={slot.display}
                  />
                  <span className="text-xs text-slate-300">{slot.appName ?? slot.appId}</span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{slot.position}</span>
                </div>
              ))}
              {workspace.slots.length === 0 && <span className="text-xs text-slate-500">No windows configured.</span>}
            </div>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}