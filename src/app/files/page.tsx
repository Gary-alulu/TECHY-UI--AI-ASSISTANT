import { FilesPanel } from "@/components/files/FilesPanel";

export default function FilesPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">
          File Command Center
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Browse the workspace or the whole machine, then search by name or content, preview PDFs, DOCX, XLSX,
          source and CSV, favorite files, catch duplicates, and hand any file to TECHY to summarize or analyze.
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <FilesPanel />
      </div>
    </div>
  );
}