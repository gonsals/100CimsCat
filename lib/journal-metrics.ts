import type { Ascent, Summit } from '@/lib/tracker'
export type AnnualGoal = {
  year: number
  metric: 'essential' | 'unique' | 'visits'
  target: number
}
export function annualProgress(
  visits: Ascent[],
  summits: Summit[],
  goal: AnnualGoal,
) {
  const selected = visits.filter((v) =>
      v.completed_at.startsWith(`${goal.year}-`),
    ),
    ids = new Set(selected.map((v) => v.summit_id))
  const count =
    goal.metric === 'visits'
      ? selected.length
      : goal.metric === 'unique'
        ? ids.size
        : summits.filter((s) => s.essential && ids.has(s.id)).length
  return {
    count,
    percent: Math.min(100, Math.round((count / goal.target) * 100)),
  }
}
export function calendarDays(month: string, visits: Ascent[]) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month')
  const [year, m] = month.split('-').map(Number),
    length = new Date(Date.UTC(year, m, 0)).getUTCDate(),
    offset = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7
  return {
    offset,
    days: Array.from({ length }, (_, i) => {
      const date = `${month}-${String(i + 1).padStart(2, '0')}`
      return { date, visits: visits.filter((v) => v.completed_at === date) }
    }),
  }
}
