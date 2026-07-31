// src/lib/studyroom/brisbaneTime.ts
// Queensland has no DST — a fixed +10:00 offset is always correct. Shared by
// the Operations Centre and the Sessions oversight view so "today"/"this
// week" mean exactly the same thing in both places.

export function brisbaneTodayWindow(now: Date = new Date()) {
  const todayKey = now.toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" }); // YYYY-MM-DD
  const start = new Date(`${todayKey}T00:00:00+10:00`);
  const end = new Date(`${todayKey}T23:59:59.999+10:00`);
  return { start, end };
}

export function startOfWeekBrisbane(now: Date = new Date()) {
  const { start } = brisbaneTodayWindow(now);
  const day = start.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  return new Date(start.getTime() - diff * 86400000);
}
