import { ProjectsPanel } from "@/components/projects/ProjectsPanel";

export default function ProjectsPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Project Workspaces</h2>
        <p className="text-sm text-slate-400 mt-1">
          Project environments give TECHY contextual awareness — folders in the workspace root or <span className="font-mono text-cyan-400/80">data/projects/</span> become workspaces with live file, document, design and task counts.
        </p>
      </div>
      <ProjectsPanel />
    </div>
  );
}