import { PluginsPanel } from "@/components/plugins/PluginsPanel";

export default function PluginsPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Plugin / Tool System</h2>
        <p className="text-sm text-slate-400 mt-1">
          TECHY&rsquo;s capability catalog, extensible with declarative custom plugins. Every plugin declares its permissions — the Security Center decides what it may do.
        </p>
      </div>
      <PluginsPanel />
    </div>
  );
}