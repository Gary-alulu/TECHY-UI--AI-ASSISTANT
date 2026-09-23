import type { TaskRepeat } from "@/types";

export interface ParsedSchedule {
  remindAt: Date;
  repeat?: TaskRepeat;
  /** Matched "when" span (lowercased) so callers can strip it from the original words. */
  matchedText: string;
}

const WEEKDAYS: Array<[string[], number]> = [
  [["sunday", "sun"], 0],
  [["monday", "mon"], 1],
  [["tuesday", "tue"], 2],
  [["wednesday", "wed"], 3],
  [["thursday", "thu"], 4],
  [["friday", "fri"], 5],
  [["saturday", "sat"], 6],
];

function atClock(hourRaw: number, minuteRaw: number, meridian?: string): { hour: number; minute: number } {
  let hour = hourRaw % 24;
  const minute = minuteRaw % 60;
  if (meridian === "pm" && hour < 12) hour += 12;
  if (meridian === "am" && hour === 12) hour = 0;
  return { hour, minute };
}

function clockToDate(hour: number, minute: number): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
  return date;
}

function nextWeekdayAt(dayIndex: number, hour: number, minute: number): Date {
  const date = new Date();
  const diff = (dayIndex - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + (diff === 0 ? 7 : diff));
  date.setHours(hour, minute, 0, 0);
  return date;
}

/** Parses phrases like "remind me tomorrow at 9 to call Sam" into a concrete schedule. */
export function parseReminderPhrase(input: string): ParsedSchedule | null {
  const low = input.toLowerCase().trim();
  if (!low) return null;

  // Relative: "in 5 minutes", "in 2 hours", "in 3 days"
  const relative = low.match(/\bin\s+(\d+)\s*(seconds?|mins?|minutes?|hrs?|hours?|days?)\b/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const ms =
      unit.startsWith("sec") ? 1_000 :
      unit.startsWith("min") ? 60_000 :
      unit.startsWith("h") ? 3_600_000 :
      86_400_000;
    return { remindAt: new Date(Date.now() + amount * ms), matchedText: relative[0] };
  }

  // "tomorrow at 9:30" / "tomorrow"
  const tomorrow = low.match(/\btomorrow(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/);
  if (tomorrow) {
    const clock = tomorrow[1] != null ? atClock(Number(tomorrow[1]), Number(tomorrow[2] ?? 0), tomorrow[3]) : { hour: 9, minute: 0 };
    const remindAt = nextWeekdayAt((new Date().getDay() + 1) % 7, clock.hour, clock.minute);
    return { remindAt, matchedText: tomorrow[0] };
  }

  // Weekday recurrence: "every monday at 9", "weekly on friday at 5"
  const weekday = low.match(/\b(?:every|each|next)\s+([a-z]+)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/);
  if (weekday) {
    const found = WEEKDAYS.find(([names]) => names.includes(weekday[1]));
    if (found) {
      const clock = weekday[2] != null ? atClock(Number(weekday[2]), Number(weekday[3] ?? 0), weekday[4]) : { hour: 9, minute: 0 };
      return { remindAt: nextWeekdayAt(found[1], clock.hour, clock.minute), repeat: "weekly", matchedText: weekday[0] };
    }
  }

  // Daily: "daily at 8", "every day"
  const daily = low.match(/\b(?:daily|every\s+day)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/);
  if (daily) {
    const clock = daily[1] != null ? atClock(Number(daily[1]), Number(daily[2] ?? 0), daily[3]) : { hour: 9, minute: 0 };
    return { remindAt: clockToDate(clock.hour, clock.minute), repeat: "daily", matchedText: daily[0] };
  }

  // Monthly: "monthly", "monthly on the 5th"
  const monthly = low.match(/\bmonthly(?:\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?)?/);
  if (monthly) {
    const day = Math.min(Math.max(Number(monthly[1] ?? new Date().getDate()), 1), 28);
    const base = new Date();
    const remindAt = new Date(base.getFullYear(), base.getMonth() + 1, day, 9, 0, 0, 0);
    return { remindAt, repeat: "monthly", matchedText: monthly[0] };
  }

  // Evening shortcut: "tonight", "this evening"
  const evening = low.match(/\b(?:tonight|this\s+evening)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/);
  if (evening) {
    const clock = evening[1] != null ? atClock(Number(evening[1]), Number(evening[2] ?? 0), evening[3]) : { hour: 19, minute: 0 };
    return { remindAt: clockToDate(clock.hour, clock.minute), matchedText: evening[0] };
  }

  // Bare clock: "at 10", "at 10:30am"
  const clock = low.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (clock) {
    const parsed = atClock(Number(clock[1]), Number(clock[2] ?? 0), clock[3]);
    return { remindAt: clockToDate(parsed.hour, parsed.minute), matchedText: clock[0] };
  }

  return null;
}

/** Advances a repeating reminder to the next occurrence at or after `now`. */
export function advanceRepeat(remindAt: Date, repeat: TaskRepeat, now = new Date()): Date {
  const next = new Date(remindAt);
  const step = () => {
    if (repeat === "daily") next.setDate(next.getDate() + 1);
    else if (repeat === "weekly") next.setDate(next.getDate() + 7);
    else if (repeat === "monthly") {
      const day = next.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDay));
    }
  };
  if (repeat === "none" || !repeat) return next;
  while (next.getTime() <= now.getTime()) step();
  return next;
}