import { ModelLabPanel } from "@/components/models/ModelLabPanel";

export default function ModelsPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Local AI Model Lab</h2>
        <p className="text-sm text-slate-400 mt-1">
          Manage Ollama models, wire the intent router and watch performance — ask TECHY <span className="font-mono text-cyan-400/80">“Use the coding model for this”</span>
        </p>
      </div>
      <ModelLabPanel />
    </div>
  );
}