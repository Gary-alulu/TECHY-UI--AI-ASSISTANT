import React from "react";
import { ScreenPanel } from "@/components/screen/ScreenPanel";

export default function ScreenPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Screen Awareness</h2>
        <p className="text-sm text-slate-400 mt-1">
          TECHY sees what&apos;s in front of you — the active window, the display frame and the colors on it. Ask
          &ldquo;what am I looking at?&rdquo; and TECHY starts from the foreground window and a local snapshot; a
          vision model turns pixels into words when one is installed.
        </p>
      </div>
      <ScreenPanel />
    </div>
  );
}
