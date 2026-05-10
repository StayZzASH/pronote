import { gradesOverview, TabLocation, GradeKind } from "pawnote";

export async function fetchPeriods(handle) {
  const gradeTab = handle.user.resources[0].tabs.get(TabLocation.Grades);
  if (!gradeTab) throw new Error("Onglet notes introuvable");

  return gradeTab.periods.map((p) => ({
    id: p.id,
    name: p.name,
    start: p.startDate,
    end: p.endDate,
  }));
}

export async function fetchGrades(handle, period) {
  const gradeTab = handle.user.resources[0].tabs.get(TabLocation.Grades);
  const pawnotePeriod = gradeTab.periods.find((p) => p.name === period.name);
  if (!pawnotePeriod) throw new Error(`Période "${period.name}" introuvable`);

  const overview = await gradesOverview(handle, pawnotePeriod);

  const subjects = [];
  const allGrades = overview.grades.map((g) => ({
    id: g.id,
    subjectId: g.subject.id,
    subjectName: g.subject.name,
    description: g.comment ?? "",
    date: g.date,
    coefficient: g.coefficient ?? 1,
    outOf: mapScore(g.outOf),
    student: mapScore(g.value),
    average: mapScore(g.average),
    min: mapScore(g.min),
    max: mapScore(g.max),
    bonus: g.isBonus ?? false,
  }));

  for (const avg of overview.subjectsAverages) {
    subjects.push({
      id: avg.subject.id,
      name: avg.subject.name,
      studentAverage: mapScore(avg.student),
      classAverage: mapScore(avg.class_average),
      max: mapScore(avg.max),
      min: mapScore(avg.min),
      grades: allGrades.filter((g) => g.subjectId === avg.subject.id),
    });
  }

  return {
    studentOverall: mapScore(overview.overallAverage),
    classAverage: mapScore(overview.classAverage),
    subjects,
  };
}

function mapScore(grade) {
  if (!grade) return { value: null, disabled: true, status: "—" };
  switch (grade.kind) {
    case GradeKind.Grade:
      return { value: grade.points ?? 0, disabled: false };
    case GradeKind.NotGraded:
      return { value: null, disabled: true, status: "N. Not." };
    case GradeKind.Absent:
      return { value: null, disabled: true, status: "Abs." };
    case GradeKind.Exempted:
      return { value: null, disabled: true, status: "Disp." };
    default:
      return { value: null, disabled: true, status: "—" };
  }
}
