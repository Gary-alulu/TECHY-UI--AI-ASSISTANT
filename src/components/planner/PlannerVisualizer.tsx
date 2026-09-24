"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  Check,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  Play,
  Sparkles,
  Target,
  Wand2,
  XCircle,
} from "lucide-react";
import type { PlanStepStatus, TaskPlan } from "@/lib/planner";

interface StepEvent {
  type: string;
  [key: string]: unknown;
}

interface ReportEvent {
  steps: Array<{ id: string; title: string; status: PlanStepStatus; result?: string }>;
  markdown: string;
}

function slugify(goal: string): string {
  return goal.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "plan";
}

function StatusIcon({ status }: { status: PlanStepStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle2 size={14} className="text-emerald-400" />;
    case "failed":
      return <XCircle size={14} className="text-red-400" />;
    case "running":
      return <Loader2 size={14} className="animate-spin text-cyan-400" />;
    default:
      return <Circle size={14} className="text-slate-600" />;
  }
}

export function PlannerVisualizer() {
  const { accent } = useBrand();
  const searchParams = useSearchParams();
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<TaskPlan | null>(null);
  const [statuses, setStatuses] = useState<Record<string, PlanStepStatus>>({});
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ReportEvent | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const usedParamRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (usedParamRef.current) return;
    usedParamRef.current = true;
    const frame = requestAnimationFrame(() => {
      const preset = searchParams.get("goal");
      if (preset) setGoal(preset);
    });
    return () => cancelAnimationFrame(frame);
  }, [searchParams]);

  const draft = useCallback(async () => {
    const value = goal.trim();
    if (!value) return;
    setError(null);
    setReport(null);
    setPlan(null);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: value }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Draft failed (${response.status})`);
      const data = (await response.json()) as { plan: TaskPlan };
      setPlan(data.plan);
      setStatuses(Object.fromEntries(data.plan.steps.map((step) => [step.id, "pending"])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft the plan");
    }
  }, [goal]);

  const run = useCallback(async () => {
    const value = goal.trim();
    if (!value || running) return;
    setError(null);
    setRunning(true);
    setReport(null);
    setElapsed(0);
    stopTimer();
    timerRef.current = setInterval(() => setElapsed((total) => total + 1), 1000);
    try {
      const response = await fetch("/api/plan/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: value }),
        cache: "no-store",
      });
      if (!response.ok || !response.body) {
        const message = await response.text().catch(() => "");
        throw new Error(message || `Run failed (${response.status})`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line) {
            let event: StepEvent;
            try {
              event = JSON.parse(line) as StepEvent;
            } catch {
              newlineIndex = buffer.indexOf("\n");
              continue;
            }
            if (event.type === "plan") {
              setPlan({
                goal: (event.goal as string) ?? value,
                slug: (event.slug as string) ?? "",
                created: new Date().toISOString(),
                intent: (event.intent as TaskPlan["intent"]) ?? { keywords: [] },
                steps: [],
              });
            }
            if (event.type === "step") {
              const index = event.index as number;
              const status = event.status as PlanStepStatus;
              const result = (event.result as string | undefined) ?? "";
              setStatuses((current) => ({ ...current, [`s${index}`]: status }));
              setPlan((current) => {
                if (!current) return current;
                const steps = [...current.steps];
                if (!steps[index]) return current;
                steps[index] = { ...steps[index], status, result };
                return { ...current, steps };
              });
            }
            if (event.type === "report") {
              setReport(event as unknown as ReportEvent);
              setStatuses(Object.fromEntries((event.steps as ReportEvent["steps"]).map((step, index) => [`s${index}`, step.status])));
            }
          }
          newlineIndex = buffer.indexOf("\n");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan execution failed");
    } finally {
      stopTimer();
      setRunning(false);
    }
  }, [goal, running, stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const download = useCallback(() => {
    if (!report) return;
    const blob = new Blob([report.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `techy-plan-${slugify(goal)}.md`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [report, goal]);

  const copyReport = useCallback(async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy — this tab needs focus.");
    }
  }, [report]);

  const activeSteps = plan?.steps ?? [];
  const doneCount = activeSteps.filter((step) => statuses[step.id] === "done" || statuses[step.id] === "failed").length;

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      {/* Left: goal + approve */}
      <GlassPanel className="lg:col-span-2 flex flex-col p-5 gap-4 border-cyan-400/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy-950 border flex items-center justify-center" style={{ borderColor: `${accent.hex}4d`, color: accent.hex, boxShadow: `0 0 16px ${accent.hex}33` }}>
            <Target size={17} />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent.hex }}>Autonomous Task Mode</div>
            <h3 className="font-display font-medium text-slate-100 text-lg tracking-wide">Plan it, approve it, run it</h3>
          </div>
        </div>

        <textarea
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void draft();
          }}
          placeholder="Prepare everything for tomorrow's client meeting…"
          className="w-full h-28 resize-none rounded-xl bg-navy-950/70 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-600 p-3 font-mono focus:outline-none focus:border-cyan-400/50"
        />

        <div className="flex gap-2 flex-wrap">
          <HUDButton variant="default" size="sm" onClick={() => void draft()} disabled={!goal.trim() || running}>
            <Wand2 size={13} className="mr-2" />
            Draft plan
          </HUDButton>
          {plan && (
            <HUDButton
              variant="outline"
              size="sm"
              className="border-emerald-400/40 text-emerald-300 hover:bg-emerald-950/20"
              onClick={() => void run()}
              disabled={running}
            >
              {running ? <Loader2 size={13} className="animate-spin mr-2" /> : <Play size={13} className="mr-2" />}
              {running ? `Running… ${elapsed}s` : "Approve & run"}
            </HUDButton>
          )}
        </div>

        {plan && (
          <div className="flex flex-wrap gap-1.5">
            {plan.intent.client && (
              <span className="px-2 py-0.5 rounded border border-cyan-400/30 text-[10px] font-mono text-cyan-300">client {plan.intent.client}</span>
            )}
            {plan.intent.date && (
              <span className="px-2 py-0.5 rounded border border-amber-400/30 text-[10px] font-mono text-amber-300">{plan.intent.date}</span>
            )}
            {plan.intent.focus && (
              <span className="px-2 py-0.5 rounded border border-violet-400/30 text-[10px] font-mono text-violet-300">focus {plan.intent.focus}</span>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-red-500/20 bg-red-950/20 text-xs text-red-300">
            <span className="min-w-0">{error}</span>
          </div>
        )}

        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-cyan-400/10 bg-cyan-950/10 text-[11px] text-slate-400">
          <Sparkles size={12} className="shrink-0 mt-0.5 text-cyan-400" />
          <span>
            Nothing runs until you approve. TECHY drafts a numbered plan over your real workspace, files and calendar —
            then executes step by step, showing every result live.
          </span>
        </div>

        {activeSteps.length > 0 && (
          <div className="mt-auto pt-4 border-t border-slate-800/70">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              {doneCount}/{activeSteps.length} steps {running ? "· running" : "· " + (report ? "complete" : "drafted")}
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-navy-950 border border-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${activeSteps.length ? Math.round((doneCount / activeSteps.length) * 100) : 0}%`, backgroundColor: accent.hex, boxShadow: `0 0 8px ${accent.hex}` }}
              />
            </div>
          </div>
        )}
      </GlassPanel>

      {/* Right: the visualizer */}
      <GlassPanel className="lg:col-span-3 flex flex-col p-5 gap-4 border-cyan-400/20 min-h-[420px]">
        {!plan ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center text-slate-600 py-10">
            <div className="w-14 h-14 rounded-xl bg-navy-950 border border-slate-800 flex items-center justify-center text-slate-600">
              <Target size={22} />
            </div>
            <p className="font-mono text-xs">TECHY PLAN</p>
            <p className="text-[11px] text-slate-600 max-w-sm">
              Describe the outcome — “prepare for tomorrow&apos;s review”, “assemble the proposal pack” — and TECHY
              will draft the numbered plan here for your approval.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 min-h-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent.hex }}>TECHY Plan</div>
                <p className="text-sm text-slate-100 font-display truncate">{plan.goal}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {report && (
                  <>
                    <HUDButton variant="ghost" size="sm" className="text-slate-400" onClick={() => void download()} title="Download report (.md)">
                      <Download size={12} className="mr-1.5" /> .md
                    </HUDButton>
                    <HUDButton variant="ghost" size="sm" className="text-slate-400" onClick={() => void copyReport()} title="Copy report">
                      {copied ? <Check size={12} className="mr-1.5 text-emerald-400" /> : <Sparkles size={12} className="mr-1.5" />}
                      {copied ? "Copied" : "Copy"}
                    </HUDButton>
                  </>
                )}
              </div>
            </div>

            <ol className="flex flex-col gap-2">
              {activeSteps.map((step, index) => {
                const status = statuses[step.id] ?? step.status;
                return (
                  <li key={step.id} className="rounded-xl bg-navy-950/70 border border-slate-800 p-3 flex items-start gap-3">
                    <span className="w-6 text-center font-mono text-[11px] text-slate-500 mt-0.5">{String(index + 1).padStart(2, "0")}</span>
                    <span className="mt-0.5 shrink-0">
                      <StatusIcon status={status} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-200">{step.title}</span>
                        {status === "done" && <span className="text-[10px] font-mono text-emerald-400/80">ok</span>}
                        {status === "failed" && <span className="text-[10px] font-mono text-red-400/80">failed</span>}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{step.detail}</p>
                      {step.result && (
                        <pre className="mt-2 whitespace-pre-wrap text-[11px] font-mono text-slate-400 leading-relaxed max-h-32 overflow-y-auto">
                          {step.result}
                        </pre>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            {report && (
              <div className="rounded-xl border border-emerald-400/20 bg-navy-950/70 p-4">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-emerald-400 mb-2">
                  <CheckCircle2 size={11} /> Report ready — saved to data/plans/
                </div>
                <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {report.markdown.slice(0, 2400)}
                </pre>
              </div>
            )}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}