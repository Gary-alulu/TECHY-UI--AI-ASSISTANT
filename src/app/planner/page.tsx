import React, { Suspense } from "react";
import { PlannerVisualizer } from "@/components/planner/PlannerVisualizer";

export default function PlannerPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Autonomous Task Mode</h2>
        <p className="text-sm text-slate-400 mt-1">
          Describe the outcome — “prepare everything for the client meeting” — and TECHY drafts a numbered plan across
          your files, calendar and knowledge, shows it for approval, then executes every step live with a visual trail.
        </p>
      </div>
      <Suspense fallback={null}>
        <PlannerVisualizer />
      </Suspense>
    </div>
  );
}