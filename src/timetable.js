import {
  timetableFromWeek,
  parseTimetable,
  translateToWeekNumber,
} from "pawnote";

export async function fetchTimetable(handle, date) {
  const weekNumber = translateToWeekNumber(date, handle.instance.firstMonday);
  const raw = await timetableFromWeek(handle, weekNumber);

  parseTimetable(handle, raw, {
    withSuperposedCanceledClasses: false,
    withCanceledClasses: true,
    withPlannedClasses: true,
  });

  const dayMap = {};

  for (const cls of raw.classes) {
    if (!cls.subject) continue;

    const from = new Date(cls.startDate);
    const to = new Date(cls.endDate);
    const dayKey = from.toISOString().split("T")[0];

    if (!dayMap[dayKey]) dayMap[dayKey] = [];

    dayMap[dayKey].push({
      id: cls.id ?? `${dayKey}-${from.getTime()}`,
      subject: cls.subject?.name ?? "Cours",
      teacher: cls.teacher ?? null,
      room: cls.rooms?.join(", ") ?? null,
      from: from.toISOString(),
      to: to.toISOString(),
      canceled: cls.isCanceled ?? false,
      detention: cls.type === "detention",
    });
  }

  return Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, courses]) => ({
      date,
      courses: courses.sort(
        (a, b) => new Date(a.from) - new Date(b.from)
      ),
    }));
}
