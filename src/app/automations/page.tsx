import { AutomationsPanel } from "@/components/automations/AutomationsPanel";

export default function AutomationsPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Automation Engine</h2>
        <p className="text-sm text-slate-400 mt-1">
          Build workflows that read, summarize, rename, move and notify. Dropping a matching file into a watched folder (e.g.{" "}
          <span className="font-mono text-cyan-400/80">data/watch</span>) fires the chain automatically.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <AutomationsPanel />
      </div>
    </div>
  );
}