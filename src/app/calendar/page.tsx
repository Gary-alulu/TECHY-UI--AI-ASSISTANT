import { CalendarPanel } from "@/components/calendar/CalendarPanel";

export default function CalendarPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Calendar</h2>
        <p className="text-sm text-slate-400 mt-1">
          Meetings, calls and appointments. Ask TECHY &ldquo;what&rsquo;s on my schedule today?&rdquo; or &ldquo;I have a meeting at 2. Prepare the relevant documents.&rdquo;
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <CalendarPanel />
      </div>
    </div>
  );
}