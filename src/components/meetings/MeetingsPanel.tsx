"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import type { Meeting } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = { planned: "Planned", active: "In progress", completed: "Completed" };

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16).replace("T", " ");
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function MeetingsPanel() {
  const { accent } = useBrand();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [participants, setParticipants] = useState("");
  const [agenda, setAgenda] = useState("");
  const [busy, setBusy] = useState(false);
  const [summarizing, setSummarizing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/meetings", { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed (${response.status})`);
      const data = (await response.json()) as { meetings: Meeting[] };
      setMeetings(data.meetings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load meetings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void refresh());
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

  const create = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          date: date || undefined,
          location: location.trim() || undefined,
          participants: participants.split(",").map((item) => item.trim()).filter(Boolean),
          agenda: agenda.split(",").map((item) => item.trim()).filter(Boolean),
        }),
      });
      if (response.status === 201) {
        await refresh();
        setTitle("");
        setDate("");
        setLocation("");
        setParticipants("");
        setAgenda("");
      } else {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not create meeting");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create meeting");
    } finally {
      setBusy(false);
    }
  }, [title, date, location, participants, agenda, refresh]);

  const summarize = useCallback(async (id: string) => {
    setSummarizing(id);
    setError(null);
    try {
      const response = await fetch(`/api/meetings/${id}`, { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error(`Failed (${response.status})`);
      const data = (await response.json()) as { meeting: Meeting };
      setMeetings((current) => current.map((meeting) => (meeting.id === id ? { ...data.meeting } : meeting)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not summarize notes");
    } finally {
      setSummarizing(null);
    }
  }, []);

  const setStatus = useCallback(async (id: string, status: Meeting["status"]) => {
    const response = await fetch(`/api/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok) {
      const data = (await response.json()) as { meeting: Meeting };
      setMeetings((current) => current.map((meeting) => (meeting.id === id ? { ...data.meeting } : meeting)));
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    setMeetings((current) => current.filter((meeting) => meeting.id !== id));
  }, []);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      {/* Add meeting */}
      <GlassPanel className="xl:col-span-2 p-5 flex flex-col gap-4 border-cyan-400/20 h-fit xl:sticky xl:top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy-950 border flex items-center justify-center" style={{ borderColor: `${accent.hex}4d`, color: accent.hex, boxShadow: `0 0 16px ${accent.hex}33` }}>
            <ClipboardCheck size={17} />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent.hex }}>Plan a meeting</div>
            <h3 className="font-display font-medium text-slate-100 text-lg tracking-wide">New meeting</h3>
          </div>
        </div>

        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          Title *
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Design review"
            className="mt-1 w-full rounded-lg bg-navy-950/70 border border-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Date
            <input value={date} onChange={(event) => setDate(event.target.value)} type="datetime-local"
              className="mt-1 w-full rounded-lg bg-navy-950/70 border border-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-400/50" />
          </label>
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Location
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Room 4 / Zoom"
              className="mt-1 w-full rounded-lg bg-navy-950/70 border border-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50" />
          </label>
        </div>
        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          Participants <span className="normal-case text-slate-600">(comma separated)</span>
          <input value={participants} onChange={(event) => setParticipants(event.target.value)} placeholder="Ada, Lin, Theo"
            className="mt-1 w-full rounded-lg bg-navy-950/70 border border-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50" />
        </label>
        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          Agenda <span className="normal-case text-slate-600">(comma separated)</span>
          <input value={agenda} onChange={(event) => setAgenda(event.target.value)} placeholder="Budget, Timeline, Launch date"
            className="mt-1 w-full rounded-lg bg-navy-950/70 border border-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50" />
        </label>

        <HUDButton variant="default" onClick={() => void create()} disabled={!title.trim() || busy}>
          {busy ? <Loader2 size={13} className="animate-spin mr-2" /> : <Plus size={13} className="mr-2" />}
          Create meeting
        </HUDButton>

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-red-500/20 bg-red-950/20 text-xs text-red-300">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span className="min-w-0">{error}</span>
          </div>
        )}
      </GlassPanel>

      {/* Meeting list */}
      <div className="xl:col-span-3 flex flex-col gap-4">
        {loading && (
          <GlassPanel className="p-8 flex items-center justify-center text-slate-500">
            <Loader2 size={20} className="animate-spin text-cyan-400 mr-3" />
            <span className="font-mono text-xs">Loading meetings…</span>
          </GlassPanel>
        )}

        {!loading && meetings.length === 0 && (
          <GlassPanel className="p-8 flex flex-col items-center justify-center gap-2 text-center text-slate-600">
            <div className="w-14 h-14 rounded-xl bg-navy-950 border border-slate-800 flex items-center justify-center">
              <Clock size={22} />
            </div>
            <p className="font-mono text-xs">No meetings yet</p>
            <p className="text-[11px] text-slate-600 max-w-xs">Plan a meeting on the left, then TECHY can walk you through it, take notes and pull out the action items.</p>
          </GlassPanel>
        )}

        {meetings.map((meeting) => (
          <GlassPanel key={meeting.id} className={cn("p-5 flex flex-col gap-3 border-slate-800", meeting.status === "completed" && "opacity-70")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-display font-medium text-slate-100 tracking-wide truncate">{meeting.title}</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-md font-mono text-[10px] uppercase tracking-wider border",
                      meeting.status === "completed" ? "text-emerald-300 border-emerald-400/30 bg-emerald-950/20"
                        : meeting.status === "active" ? "text-cyan-300 border-cyan-400/30 bg-cyan-950/20"
                          : "text-slate-400 border-slate-700 bg-slate-800/40"
                    )}
                  >
                    {STATUS_LABEL[meeting.status]}
                  </span>
                </div>
                <div className="mt-1 text-[11px] font-mono text-slate-500 flex items-center gap-2 flex-wrap">
                  <span>{formatDate(meeting.date)}</span>
                  {meeting.location && <span>· {meeting.location}</span>}
                  {(meeting.participants ?? []).length > 0 && (
                    <span className="flex items-center gap-1"><Users size={10} /> {meeting.participants!.join(", ")}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {meeting.status !== "completed" && (
                  <HUDButton variant="ghost" size="sm" className="text-emerald-400" onClick={() => void setStatus(meeting.id, "completed")} title="Mark completed">
                    <Check size={14} />
                  </HUDButton>
                )}
                <HUDButton variant="ghost" size="sm" className="text-red-400" onClick={() => void remove(meeting.id)} title="Delete">
                  <Trash2 size={14} />
                </HUDButton>
              </div>
            </div>

            {(meeting.agenda.length > 0 || meeting.notes) && (
              <div className="flex flex-col gap-1.5 text-xs text-slate-400">
                {meeting.agenda.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {meeting.agenda.map((item, index) => (
                      <span key={index} className="px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700/60 text-[10px] text-slate-300">{item}</span>
                    ))}
                  </div>
                )}
                {meeting.notes && (
                  <p className="text-xs text-slate-400 whitespace-pre-wrap line-clamp-3 border-l-2 pl-3 border-slate-700/70">{meeting.notes}</p>
                )}
              </div>
            )}

            {meeting.keyDecisions.length > 0 && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Key decisions</div>
                <ol className="flex flex-col gap-1">
                  {meeting.keyDecisions.map((decision, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-cyan-400 font-mono mt-0.5 shrink-0">{index + 1}.</span>
                      <span className="min-w-0">{decision}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {meeting.actionItems.length > 0 && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Action items</div>
                <ul className="flex flex-col gap-1">
                  {meeting.actionItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-xs text-slate-300">
                      <span className={cn("w-3.5 h-3.5 rounded border flex items-center justify-center", item.done ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-400" : "border-slate-600")}>
                        {item.done && <Check size={9} />}
                      </span>
                      <span className={cn(item.done && "line-through text-slate-500")}>{item.text}</span>
                      {item.owner && <span className="text-[10px] text-slate-500 font-mono">· {item.owner}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end border-t border-slate-800/70 pt-2.5">
              <HUDButton
                variant="outline"
                size="sm"
                className="text-cyan-300 border-cyan-400/30"
                onClick={() => void summarize(meeting.id)}
                disabled={summarizing === meeting.id}
              >
                {summarizing === meeting.id
                  ? <Loader2 size={12} className="animate-spin mr-1.5" />
                  : <Sparkles size={12} className="mr-1.5" />}
                {summarizing === meeting.id ? "Summarizing…" : "Summarize notes"}
              </HUDButton>
            </div>

            {meeting.summary && (
              <div className="rounded-lg bg-navy-950/60 border border-slate-800 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 size={11} className="text-emerald-400" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Summary</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{meeting.summary}</p>
              </div>
            )}
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}