import React from "react";
import { ResearchPanel } from "@/components/research/ResearchPanel";

export default function ResearchPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Research Mode</h2>
        <p className="text-sm text-slate-400 mt-1">
          Question → sources → comparison → citations. TECHY searches, fetches and compares across pages — or across
          your local knowledge base when you&apos;re offline — then hands you a summarized, cited report you can
          download.
        </p>
      </div>
      <ResearchPanel />
    </div>
  );
}