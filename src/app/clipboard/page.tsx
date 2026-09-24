import React, { Suspense } from "react";
import { ClipboardIntel } from "@/components/clipboard/ClipboardIntel";

export default function ClipboardPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Clipboard Intelligence</h2>
        <p className="text-sm text-slate-400 mt-1">
          TECHY reads your clipboard and decides what it can do with it — summarize, rewrite, translate,
          explain, improve, convert or save. Works in the browser, in the command palette, and globally on
          the desktop via the launcher overlay.
        </p>
      </div>
      <Suspense fallback={null}>
        <ClipboardIntel />
      </Suspense>
    </div>
  );
}