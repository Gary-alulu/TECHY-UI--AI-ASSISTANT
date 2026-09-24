import { CommandsPanel } from "@/components/commands/CommandsPanel";

export default function CommandsPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Command History & Templates</h2>
        <p className="text-sm text-slate-400 mt-1">
          Re-run everything TECHY has been asked, or save a phrase for later
        </p>
      </div>
      <CommandsPanel />
    </div>
  );
}