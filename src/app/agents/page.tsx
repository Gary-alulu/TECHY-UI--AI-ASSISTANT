import { AgentsPanel } from "@/components/agents/AgentsPanel";

export default function AgentsPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">AI Agents</h2>
        <p className="text-sm text-slate-400 mt-1">
          TECHY routes each request to a specialist agent. They share the local core today; each becomes independently model-backed as you add models.
        </p>
      </div>
      <AgentsPanel />
    </div>
  );
}