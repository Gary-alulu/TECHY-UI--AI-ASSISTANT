import { SecurityPanel } from "@/components/security/SecurityPanel";

export default function SecurityPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Security Center</h2>
        <p className="text-sm text-slate-400 mt-1">
          TECHY controls this computer — so it answers to you. Set permissions, force local-only mode and control visibility into its actions.
        </p>
      </div>
      <SecurityPanel />
    </div>
  );
}