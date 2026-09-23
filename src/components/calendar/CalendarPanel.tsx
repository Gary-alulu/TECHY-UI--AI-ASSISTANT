"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { HUDButton } from "../ui/HUDButton";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, PackageCheck, Loader2, CalendarClock, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types";

interface PrepFinding {
  type: "notes" | "proposal" | "folder" | "images" | "document";
  label: string;
  detail: string;
  path?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDateTimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CalendarPanel() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [month, setMonth] = useState<Date>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [startInput, setStartInput] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [prepResults, setPrepResults] = useState<Map<string, PrepFinding[]>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/calendar", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { events: CalendarEvent[] };
      setEvents(data.events);
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(load);
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !startInput || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, start: new Date(startInput).toISOString(), location, notes }),
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setTitle("");
      setStartInput("");
      setLocation("");
      setNotes("");
      await load();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to add event");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/calendar/${id}`, { method: "DELETE" });
      await load();
    } catch {
      // refresh below still
    }
  };

  const prepare = async (id: string) => {
    setPreparingId(id);
    try {
      const response = await fetch("/api/calendar/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { findings: PrepFinding[] };
      setPrepResults((map) => {
        const next = new Map(map);
        next.set(id, data.findings);
        return next;
      });
      await load();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Preparation failed");
    } finally {
      setPreparingId(null);
    }
  };

  const dayEvents = events.filter((event) => isSameDay(new Date(event.start), selected));
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = monthStart.getDay();
  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  for (let index = 0; index < 42; index++) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), index - lead + 1);
    cells.push({ date, inMonth: date.getMonth() === month.getMonth() });
  }

  const eventsOnDay = (date: Date) => events.filter((event) => isSameDay(new Date(event.start), date));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0" ref={panelRef}>
      {/* Month Grid */}
      <GlassPanel
        header={
          <div className="flex items-center gap-2">
            <CalendarDays size={14} />
            <span>{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
          </div>
        }
        headerAction={
          <div className="flex items-center gap-1">
            <HUDButton variant="ghost" size="icon" className="w-7 h-7" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
              <ChevronLeft size={14} />
            </HUDButton>
            <HUDButton variant="ghost" size="icon" className="w-7 h-7" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
              <ChevronRight size={14} />
            </HUDButton>
          </div>
        }
        className="lg:col-span-2"
      >
        <div>
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-center text-[9px] font-mono uppercase tracking-widest text-slate-500 py-1">{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map(({ date, inMonth }) => {
              const dayEventsList = eventsOnDay(date);
              const isSelected = isSameDay(date, selected);
              const isToday = isSameDay(date, new Date());
              const prepared = dayEventsList.filter((event) => event.preparedAt).length;
              return (
                <button
                  key={date.getTime()}
                  type="button"
                  onClick={() => setSelected(date)}
                  className={cn(
                    "aspect-square rounded-md border text-left p-1.5 transition-colors relative",
                    inMonth ? "bg-navy-950/40" : "bg-transparent",
                    isSelected
                      ? "border-cyan-400/60 bg-cyan-950/30"
                      : "border-slate-800/40 hover:border-slate-600"
                  )}
                >
                  <span className={cn("text-[10px] font-mono", isToday ? "text-cyan-400 font-bold" : inMonth ? "text-slate-400" : "text-slate-700")}>
                    {date.getDate()}
                  </span>
                  {dayEventsList.length > 0 && (
                    <span className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-0.5">
                      {dayEventsList.slice(0, 3).map((event) => (
                        <span key={event.id} className="flex-1 min-w-0 h-1 rounded-full" style={{ backgroundColor: event.preparedAt ? "#34d399" : event.color ?? "#22d3ee" }} />
                      ))}
                    </span>
                  )}
                  {prepared > 0 && (
                    <PackageCheck size={9} className="absolute top-1 right-1 text-emerald-400" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] font-mono text-slate-600 mt-3 flex items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full bg-cyan-400" /> scheduled</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full bg-emerald-400" /> prepared</span>
          </p>
        </div>

        {/* Add Event */}
        <form onSubmit={submit} className="mt-4 space-y-3 border-t border-slate-800/60 pt-4">
          <div className="flex items-center gap-2">
            <CalendarClock size={14} className="text-cyan-400/80 shrink-0" />
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Event title... e.g. Client Meeting"
              maxLength={120}
              className="flex-1 bg-navy-950/60 border border-slate-800/60 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50"
            />
            <HUDButton type="submit" size="sm" disabled={!title.trim() || !startInput || saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            </HUDButton>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="datetime-local"
              value={startInput || toDateTimeLocal(selected)}
              onChange={(event) => setStartInput(event.target.value)}
              className="bg-navy-950/60 border border-slate-800/60 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-400/50 [color-scheme:dark]"
            />
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Location"
              maxLength={80}
              className="bg-navy-950/60 border border-slate-800/60 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50"
            />
          </div>
          {errorMessage && <p className="text-[10px] font-mono text-rose-400">{errorMessage}</p>}
        </form>
      </GlassPanel>

      {/* Day Agenda */}
      <GlassPanel header={selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} className="flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-16 rounded-lg bg-slate-800/30 animate-pulse" />)}
            </div>
          ) : dayEvents.length === 0 ? (
            <p className="text-[11px] font-mono text-slate-700 py-6 text-center">Nothing scheduled this day.</p>
          ) : (
            dayEvents.map((event) => {
              const findings = prepResults.get(event.id);
              return (
                <div key={event.id} className="p-3 rounded-lg border border-slate-800/50 bg-navy-950/40">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-[11px] text-cyan-400 pt-0.5 w-12 shrink-0">
                      {new Date(event.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200">{event.title}</p>
                      {event.location && <p className="text-[10px] font-mono text-slate-500 mt-0.5">{event.location}</p>}
                      {event.notes && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{event.notes}</p>}
                      {event.preparedAt && (
                        <p className="text-[9px] font-mono text-emerald-400 mt-1 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Prepared {new Date(event.preparedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                      {findings && (
                        <div className="mt-2 space-y-1">
                          {findings.map((finding, index) => (
                            <div key={index} className="flex items-start gap-1.5 text-[10px] font-mono text-slate-400">
                              <span className="text-cyan-500">·</span>
                              <span className="min-w-0">
                                <span className="text-cyan-400/80">{finding.label}:</span> {finding.detail}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {event.preparedAt ? (
                        <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                          <PackageCheck size={11} /> ready
                        </span>
                      ) : (
                        <HUDButton variant="outline" size="sm" onClick={() => prepare(event.id)} disabled={preparingId === event.id} className="h-7 px-2 text-[10px]">
                          {preparingId === event.id ? <Loader2 size={11} className="animate-spin" /> : <><PackageCheck size={11} /> prepare</>}
                        </HUDButton>
                      )}
                      <button type="button" onClick={() => remove(event.id)} className="p-1 text-slate-600 hover:text-rose-300" title="Remove event">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
