"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { HUDButton } from "../ui/HUDButton";
import { Image as ImageIcon, Ruler, Palette, Loader2, ZoomIn, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageInspection } from "@/types";

interface WorkspaceImage {
  path: string;
  name: string;
  size: number;
}

export function DesignerPanel() {
  const [images, setImages] = useState<WorkspaceImage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [inspection, setInspection] = useState<ImageInspection | null>(null);
  const [loadingImages, setLoadingImages] = useState(true);
  const [loadingInspect, setLoadingInspect] = useState(false);

  const loadImages = useCallback(async () => {
    try {
      const response = await fetch("/api/imaging", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { images: WorkspaceImage[] };
      setImages(data.images);
    } catch {
      // no images yet
    } finally {
      setLoadingImages(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(loadImages);
    return () => cancelAnimationFrame(frame);
  }, [loadImages]);

  const inspect = async (imagePath: string) => {
    setSelected(imagePath);
    setLoadingInspect(true);
    try {
      const response = await fetch(`/api/imaging?path=${encodeURIComponent(imagePath)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Inspection failed");
      const data = (await response.json()) as { inspection: ImageInspection };
      setInspection(data.inspection);
    } catch {
      setInspection(null);
    } finally {
      setLoadingInspect(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      <GlassPanel header={<span className="flex items-center gap-2"><ImageIcon size={14} className="text-emerald-400" /> Workspace images · {images.length}</span>} className="xl:col-span-2 h-full">
        {loadingImages ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-8 rounded bg-slate-800/30 animate-pulse" />)}
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-[11px] font-mono text-slate-600 mb-2">No PNG/JPEG images found in the workspace.</p>
            <p className="text-[10px] font-mono text-slate-700">Drop an artwork file into data/fixtures to test the inspector.</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
            {images.map((image) => (
              <button
                key={image.path}
                type="button"
                onClick={() => inspect(image.path)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[11px] font-mono transition-colors",
                  selected === image.path ? "bg-cyan-950/40 border border-cyan-400/30 text-cyan-300" : "text-slate-400 hover:bg-slate-800/40 border border-transparent"
                )}
              >
                <ImageIcon size={12} className="shrink-0" />
                <span className="truncate flex-1">{image.name}</span>
                <span className="text-slate-600">{(image.size / 1024).toFixed(1)} KB</span>
              </button>
            ))}
          </div>
        )}
      </GlassPanel>

      <GlassPanel header={<span className="flex items-center gap-2"><ZoomIn size={14} className="text-cyan-400" /> Image inspector</span>} className="xl:col-span-3 h-full">
        {loadingInspect ? (
          <div className="h-64 flex items-center justify-center text-slate-600">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : !inspection ? (
          <div className="h-64 flex flex-col items-center justify-center text-center px-8">
            <HUDButton variant="outline" size="sm" onClick={loadImages}>
              <ImageIcon size={12} /> Load workspace images
            </HUDButton>
            <p className="text-[10px] font-mono text-slate-600 mt-3">Select an image. TECHY reads dimensions, color mode, palette and print readiness — no model required.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-navy-950 border border-slate-800 flex items-center justify-center">
                <Printer size={20} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">{inspection.name}</p>
                <p className="text-[10px] font-mono text-slate-500">{inspection.format.toUpperCase()} · {(inspection.bytes / 1024).toFixed(1)} KB</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-slate-800/50 bg-navy-950/40">
                <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1"><Ruler size={10} /> Dimensions</div>
                <p className="text-lg font-mono text-cyan-300">{inspection.width} × {inspection.height}</p>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">{inspection.bitDepth ?? "?"}-bit · {inspection.colorMode ?? "—"}</p>
              </div>
              <div className="p-3 rounded-lg border border-slate-800/50 bg-navy-950/40">
                <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1"><Palette size={10} /> Dominant palette</div>
                {inspection.palette.length > 0 ? (
                  <div className="flex gap-1.5 mt-1">
                    {inspection.palette.map((color) => (
                      <div key={color.hex} className="flex-1">
                        <div className="h-8 rounded-md border border-slate-700/50" style={{ backgroundColor: color.hex }} title={`${color.hex} · ${color.share}%`} />
                        <p className="text-[8px] font-mono text-slate-500 mt-0.5 text-center">{color.hex}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] font-mono text-slate-600 mt-1">JPEG/unsupported — palette sampling works best on PNG.</p>
                )}
              </div>
            </div>

            {inspection.printInfo && (
              <div className={cn("p-3 rounded-lg border", inspection.printInfo.qualifies ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5")}>
                <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5"><Printer size={10} /> Print check · 300 DPI</p>
                <p className="text-sm text-slate-200">
                  Prints up to <span className="font-mono text-cyan-300">{inspection.printInfo.maxWidthCm} × {inspection.printInfo.maxHeightCm} cm</span>
                </p>
                <p className={cn("text-[11px] font-mono mt-1", inspection.printInfo.qualifies ? "text-emerald-400" : "text-amber-400")}>
                  {inspection.printInfo.qualifies ? "Qualifies for large-format output." : "Below the 40 cm large-format threshold — request a higher-resolution export."}
                </p>
              </div>
            )}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}