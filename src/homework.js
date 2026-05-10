import { assignmentsFromWeek, translateToWeekNumber } from "pawnote";

export async function fetchHomework(handle, date) {
  const weekNumber = translateToWeekNumber(date, handle.instance.firstMonday);
  const assignments = await assignmentsFromWeek(handle, weekNumber);

  return assignments.map((hw) => ({
    id: hw.id,
    subject: hw.subject?.name ?? "Matière inconnue",
    content: hw.description ?? "",
    dueDate: hw.deadline?.toISOString() ?? null,
    done: hw.done ?? false,
    attachments: (hw.attachments ?? []).map((a) => ({
      name: a.name,
      url: a.url,
    })),
  }));
}
