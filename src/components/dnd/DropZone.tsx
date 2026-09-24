"use client";

import React, { useCallback, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBrand } from "@/context/BrandContext";
import {
  Archive,
  Code2,
  FileText,
  FilePlus2,
  Film,
  Image,
  Music2,
  Table2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dispatchDroppedFiles, dispatchDroppedText, setPendingFiles, setPendingText } from "@/lib/intake";

const DROP_CATEGORIES = [
  { label: "PDF", icon: FileText },
  { label: "Image", icon: Image },
  { label: "Audio", icon: Music2 },
  { label: "Video", icon: Film },
  { label: "Spreadsheet", icon: Table2 },
  { label: "Code", icon: Code2 },
  { label: "Archive", icon: Archive },
  { label: "Other", icon: FilePlus2 },
];

const CLIPBOARD_PATHS = new Set(["/clipboard"]);

export function DropZone() {
  const { accent } = useBrand();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [over, setOver] = useState<"files" | "text" | null>(null);
  const depthRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const active = pathname !== "/chat";

  const show = (kind: "files" | "text") => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setVisible(true);
    setOver((current) => current ?? kind);
  };

  const hide = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (depthRef.current === 0) {
        setVisible(false);
        setOver(null);
      }
    }, 120);
  };

  const cancel = () => {
    depthRef.current = 0;
    setVisible(false);
    setOver(null);
  };

  const handleTextDrop = useCallback(
    (text: string) => {
      setPendingText(text);
      dispatchDroppedText(text);
      if (!CLIPBOARD_PATHS.has(pathname)) {
        router.push("/clipboard?from=drop");
      }
    },
    [pathname, router]
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      setPendingFiles(files);
      dispatchDroppedFiles(files);
      if (pathname !== "/chat") {
        router.push("/chat?drop=1");
      }
    },
    [pathname, router]
  );

  React.useEffect(() => {
    if (!active) return undefined;

    const onDragEnter = (event: DragEvent) => {
      const types = event.dataTransfer?.types ?? [];
      if (types.includes("Files")) {
        depthRef.current += 1;
        show("files");
      } else if (types.includes("text/plain") || types.includes("Text")) {
        depthRef.current += 1;
        show("text");
      }
    };

    const onDragOver = (event: DragEvent) => {
      if (!visible) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      const types = event.dataTransfer?.types ?? [];
      setOver(types.includes("Files") ? "files" : "text");
    };

    const onDragLeave = () => {
      if (depthRef.current > 0) depthRef.current -= 1;
      if (depthRef.current === 0) hide();
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      const types = event.dataTransfer?.types ?? [];
      const files = Array.from(event.dataTransfer?.files ?? []).slice(0, 8);

      if (files.length > 0) {
        depthRef.current = 0;
        setVisible(false);
        setOver(null);
        handleFiles(files);
        return;
      }

      if (types.some((type) => type === "text/plain" || type === "Text")) {
        const text = event.dataTransfer?.getData("text/plain") ?? "";
        depthRef.current = 0;
        setVisible(false);
        setOver(null);
        if (text.trim()) handleTextDrop(text);
      }
    };

    const onDragEnd = () => cancel();

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onDragEnd);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
    };
  }, [active, visible, pathname, handleFiles, handleTextDrop]);

  if (!active || !visible) return null;

  const filesOver = over === "files";

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none">
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-md" />
      <div
        className="pointer-events-none absolute inset-0 cm-grid opacity-30"
        style={{ borderColor: `${accent.hex}22` }}
      />
      <div className="absolute inset-x-0 top-0 h-px cm-beam" style={{ background: `linear-gradient(90deg, transparent, ${accent.hex}, transparent)` }} />

      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          className={cn(
            "relative w-full max-w-2xl rounded-2xl border bg-navy-950/95 backdrop-blur-2xl shadow-2xl px-8 py-10 text-center transition-all duration-200",
            filesOver ? "scale-[1.02]" : "scale-100"
          )}
          style={{
            borderColor: filesOver ? `${accent.hex}88` : `${accent.hex}44`,
            boxShadow: filesOver
              ? `0 0 0 1px ${accent.hex}44, 0 0 64px ${accent.hex}33`
              : `0 0 0 1px ${accent.hex}22, 0 24px 80px rgba(2,8,23,0.9)`,
          }}
        >
          <div
            className="pointer-events-none absolute -left-px -top-px w-8 h-8 border-l-2 border-t-2 rounded-tl-2xl"
            style={{ borderColor: accent.hex }}
          />
          <div
            className="pointer-events-none absolute -right-px -top-px w-8 h-8 border-r-2 border-t-2 rounded-tr-2xl"
            style={{ borderColor: accent.hex }}
          />
          <div
            className="pointer-events-none absolute -left-px -bottom-px w-8 h-8 border-l-2 border-b-2 rounded-bl-2xl"
            style={{ borderColor: accent.hex }}
          />
          <div
            className="pointer-events-none absolute -right-px -bottom-px w-8 h-8 border-r-2 border-b-2 rounded-br-2xl"
            style={{ borderColor: accent.hex }}
          />

          <div className="mx-auto w-16 h-16 rounded-full border flex items-center justify-center mb-4" style={{ borderColor: `${accent.hex}66`, color: accent.hex, boxShadow: `0 0 32px ${accent.hex}44` }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: accent.hex }} className="animate-pulse" />
          </div>

          <div className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: accent.hex }}>
            {filesOver ? "Release to hand to TECHY" : "Drop text to analyze"}
          </div>
          <h2 className="font-display text-2xl font-medium text-slate-100 mt-1 tracking-wide">DROP ANYTHING</h2>
          <p className="text-sm text-slate-400 mt-1">
            TECHY inspects the file and decides what it can do with it.
          </p>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 mt-8">
            {DROP_CATEGORIES.map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2 text-slate-400">
                <div className={cn(
                  "w-12 h-12 rounded-lg border bg-navy-900/70 flex items-center justify-center transition-colors",
                  filesOver ? "border-cyan-400/40 text-cyan-400" : "border-slate-800 text-slate-500"
                )}>
                  <item.icon size={18} />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider">{item.label}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { depthRef.current = 0; setVisible(false); setOver(null); }}
            className="pointer-events-auto absolute right-4 top-4 text-slate-600 hover:text-slate-300 transition-colors"
            aria-label="Dismiss drop overlay"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}