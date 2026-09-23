import { DesignerPanel } from "@/components/designer/DesignerPanel";

export default function DesignerPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Designer Mode · Creative Workspace</h2>
        <p className="text-sm text-slate-400 mt-1">
          Inspect artwork offline — dimensions, color mode, dominant palette and whether it survives a 300&nbsp;DPI print. Ask TECHY to &ldquo;prepare the artwork for large-format printing&rdquo;.
        </p>
      </div>
      <DesignerPanel />
    </div>
  );
}