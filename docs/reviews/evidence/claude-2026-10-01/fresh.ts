import { evaluateFreshness } from "/home/user/KWMPF/apps/api/src/freshness";
const cases: [string, number, string][] = [
  ["2026-08-31", 45, "2026-10-15"], ["2026-08-31", 45, "2026-10-16"],
  ["2026-07-31", 90, "2026-10-29"], ["2026-07-31", 90, "2026-10-30"],
  ["2026-08-31", 90, "2026-11-29"], ["2026-08-31", 90, "2026-11-30"],
];
for (const [asOf, grace, today] of cases) {
  const r = evaluateFreshness(asOf, grace, new Date(`${today}T12:00:00Z`));
  console.log(asOf, `grace=${grace}`, today, r.status, `age=${r.ageDays}`);
}
