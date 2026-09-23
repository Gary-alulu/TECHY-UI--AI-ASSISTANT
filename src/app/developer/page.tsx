import { DeveloperPanel } from "@/components/developer/DeveloperPanel";

export default function DeveloperPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Developer Mode</h2>
        <p className="text-sm text-slate-400 mt-1">
          Git, logs, ports and package scripts for the project. Ask TECHY &ldquo;why isn&rsquo;t my Next.js application starting?&rdquo; to get it handled automatically.
        </p>
      </div>
      <DeveloperPanel />
    </div>
  );
}