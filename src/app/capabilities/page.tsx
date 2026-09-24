import { CapabilitiesPanel } from "@/components/capabilities/CapabilitiesPanel";

export default function CapabilitiesPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">What Can I Do?</h2>
        <p className="text-sm text-slate-400 mt-1">
          Everything TECHY can help with — ask in chat <span className="font-mono text-cyan-400/80">“What can you do?”</span>
        </p>
      </div>
      <CapabilitiesPanel />
    </div>
  );
}