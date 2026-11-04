'use client'
import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  annualProgress,
  calendarDays,
  type AnnualGoal,
} from '@/lib/journal-metrics'
import {
  ascentKey,
  localDate,
  type Ascent,
  type Language,
  type Summit,
} from '@/lib/tracker'
import { mountainText } from '@/lib/mountain-i18n'
export default function JournalInsights({
  supabase,
  userId,
  summits,
  visits,
  language,
  onEdit,
}: {
  supabase: SupabaseClient
  userId: string
  summits: Summit[]
  visits: Ascent[]
  language: Language
  onEdit: (summit: Summit, visit: Ascent) => void
}) {
  const [goals, setGoals] = useState<AnnualGoal[]>([]),
    [year, setYear] = useState(Number(localDate().slice(0, 4))),
    [metric, setMetric] = useState<AnnualGoal['metric']>('essential'),
    [target, setTarget] = useState(15),
    [month, setMonth] = useState(localDate().slice(0, 7)),
    [day, setDay] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false)
  const t = (key: Parameters<typeof mountainText>[1]) =>
    mountainText(language, key)
  useEffect(() => {
    let active = true
    const load = () =>
      void Promise.resolve(
        supabase
          .from('journal_goals')
          .select('year,metric,target')
          .eq('user_id', userId)
          .order('year'),
      )
        .then(({ data, error }) => {
          if (active) {
            if (error) setError(true)
            else setGoals(data as AnnualGoal[])
          }
        })
        .catch(() => {
          if (active) setError(true)
        })
    load()
    window.addEventListener('journal-restored', load)
    return () => {
      active = false
      window.removeEventListener('journal-restored', load)
    }
  }, [supabase, userId])
  useEffect(() => {
    const goal = goals.find((g) => g.year === year)
    setMetric(goal?.metric ?? 'essential')
    setTarget(goal?.target ?? 15)
  }, [goals, year])
  const goal = goals.find((g) => g.year === year),
    progress = goal ? annualProgress(visits, summits, goal) : null
  const calendar = useMemo(() => calendarDays(month, visits), [month, visits]),
    selected = visits.filter((v) => v.completed_at === day)
  async function save() {
    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100 ||
      !Number.isInteger(target) ||
      target < 1 ||
      target > 1000
    )
      return
    setBusy(true)
    setError(false)
    try {
      const { error } = await supabase
        .from('journal_goals')
        .upsert(
          { user_id: userId, year, metric, target },
          { onConflict: 'user_id,year' },
        )
      if (error) throw error
      setGoals((previous) => [
        ...previous.filter((g) => g.year !== year),
        { year, metric, target },
      ])
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="mountain-panel" aria-label={t('insights')}>
      <h2>{t('insights')}</h2>
      <details>
        <summary>{t('goal')}</summary>
        <div className="mountain-form">
          <label>
            {t('year')}
            <input
              aria-label={t('year')}
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <label>
            {t('metric')}
            <select
              aria-label={t('metric')}
              value={metric}
              onChange={(e) =>
                setMetric(e.target.value as AnnualGoal['metric'])
              }
            >
              {(['essential', 'unique', 'visits'] as const).map((key) => (
                <option value={key} key={key}>
                  {t(key)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('target')}
            <input
              aria-label={t('target')}
              type="number"
              min={1}
              max={1000}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={() => void save()}
          >
            {t('save')}
          </button>
        </div>
        {progress && (
          <p role="status">
            <strong>
              {progress.count} / {goal!.target}
            </strong>{' '}
            · {progress.percent}%{' '}
            <progress
              max={100}
              value={progress.percent}
              aria-label={t('goal')}
            />
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {t('error')}
          </p>
        )}
      </details>
      <details>
        <summary>{t('calendar')}</summary>
        <label className="feature-field">
          {t('month')}
          <input
            aria-label={t('month')}
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value)
                setDay('')
              }
            }}
          />
        </label>
        <div className="visit-calendar" role="group" aria-label={t('calendar')}>
          {Array.from({ length: 7 }, (_, i) => (
            <span className="calendar-weekday" key={`weekday${i}`}>
              {new Intl.DateTimeFormat(language, {
                weekday: 'short',
                timeZone: 'UTC',
              }).format(new Date(Date.UTC(2024, 0, 1 + i)))}
            </span>
          ))}
          {Array.from({ length: calendar.offset }, (_, i) => (
            <span key={`pad${i}`} />
          ))}
          {calendar.days.map((item) => (
            <button
              type="button"
              key={item.date}
              disabled={!item.visits.length}
              aria-label={`${item.date}: ${item.visits.length}`}
              aria-pressed={day === item.date}
              onClick={() => setDay(item.date)}
            >
              {Number(item.date.slice(-2))}
              {item.visits.length > 0 && <small>{item.visits.length}</small>}
            </button>
          ))}
        </div>
        {day && (
          <ul>
            {selected.map((visit) => {
              const summit = summits.find((s) => s.id === visit.summit_id)
              return summit ? (
                <li key={ascentKey(visit)}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onEdit(summit, visit)}
                  >
                    {summit.name} · {day}
                  </button>
                </li>
              ) : null
            })}
          </ul>
        )}
      </details>
    </section>
  )
}
