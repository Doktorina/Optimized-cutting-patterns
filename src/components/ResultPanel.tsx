/**
 * Панель результата линейного раскроя.
 * Блоки включаются/сортируются по settings.resultVisible / resultOrder.
 */
import type { ReactNode } from 'react'
import type { PartItem, Settings, SolveResult, StockItem } from '../types'
import { partCalcLength } from '../types'
import { CuttingMap, sizesFromZero, textScheme } from './CuttingMap'

type Props = {
  result: SolveResult
  settings: Settings
  stocks: StockItem[]
  parts: PartItem[]
  cuttingName: string
  onCuttingNameChange: (name: string) => void
  error: string | null
}

function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '—'
  const rounded = Math.round(n * 10 ** digits) / 10 ** digits
  return String(rounded)
}

export function ResultPanel({
  result,
  settings,
  stocks,
  parts,
  cuttingName,
  onCuttingNameChange,
  error,
}: Props) {
  if (error) {
    return (
      <div className="error-box" id="result-anchor">
        Ошибка! {error}
      </div>
    )
  }

  if (!result) return null

  const usefulRemainders = result.remainders.filter(
    (r) => r.length >= (settings.usefulRemainderMin || 0) && r.length > 0,
  )

  const jsonPayload = {
    name: cuttingName,
    bladeKerf: settings.bladeKerf,
    trimming: settings.trimming,
    stocksUsed: result.stocksUsed,
    usefulPercent: result.usefulPercent,
    wastePercent: result.wastePercent,
    wasteLength: result.wasteLength,
    cutCount: result.cutCount,
    patterns: result.grouped.map((g) => ({
      count: g.count,
      stockLength: g.pattern.stockLength,
      parts: g.pattern.parts.map((p) => ({ length: p.length, name: p.name })),
      waste: g.pattern.waste,
    })),
    remainders: result.remainders,
  }

  const blocks: Record<string, ReactNode> = {
    cuttingName: (
      <label className="cutting-name-field">
        <textarea
          value={cuttingName}
          onChange={(e) => onCuttingNameChange(e.target.value)}
          placeholder="Название и описание"
          rows={2}
        />
      </label>
    ),
    unusedStocks: result.unusedStocks.length > 0 && (
      <>
        <h3>Неиспользованные заготовки:</h3>
        <ul className="remainders-list">
          {result.unusedStocks.map((s) => (
            <li key={`${s.length}-${s.name}`}>
              {s.length}
              {s.name ? ` ${s.name}` : ''} — {s.quantity} шт.
            </li>
          ))}
        </ul>
      </>
    ),
    uncutParts: result.uncutParts.length > 0 && (
      <>
        <h3>Неразрезанные отрезки:</h3>
        <ul className="remainders-list">
          {result.uncutParts.map((p) => (
            <li key={`${p.length}-${p.name}`}>
              {p.length}
              {p.name ? ` ${p.name}` : ''} — {p.quantity} шт.
            </li>
          ))}
        </ul>
      </>
    ),
    stocksUsed: (
      <>
        <h3>Использовано заготовок:</h3>
        {result.stocksUsed.map((s) => (
          <div key={`${s.length}-${s.name}`} className="stats-line">
            длина {fmt(s.length, 3)}
            {s.name ? ` «${s.name}»` : ''} — взято {s.count} шт. (сумма {fmt(s.totalLength, 3)})
          </div>
        ))}
        <div className="stats-line" style={{ marginTop: 12 }}>
          Польза: {fmt(result.usefulPercent)}%
        </div>
        <div className="stats-line">
          Остатки: {fmt(result.wastePercent)}% ({fmt(result.wasteLength, 2)})
        </div>
        <div className="stats-line">Количество разрезов: {result.cutCount}</div>
      </>
    ),
    cuttingMap: (
      <>
        <h3>Схема раскроя:</h3>
        <CuttingMap grouped={result.grouped} settings={settings} />
      </>
    ),
    textScheme: (
      <>
        <h3>Схема раскроя в текстовом формате:</h3>
        <div className="text-scheme">{textScheme(result.grouped, settings)}</div>
      </>
    ),
    sizesFromZero: (
      <>
        <h3>Размеры от нуля:</h3>
        <div className="text-scheme">{sizesFromZero(result.grouped, settings)}</div>
      </>
    ),
    usefulRemainders: (
      <>
        <h3>Полезные остатки:</h3>
        {usefulRemainders.length === 0 ? (
          <div className="stats-line">Нет</div>
        ) : (
          <ul className="remainders-list">
            {usefulRemainders.map((r) => (
              <li key={`${r.length}|${r.name || ''}`}>
                {fmt(r.length, 2)}
                {r.name ? ` «${r.name}»` : ''} — {r.count} шт.
              </li>
            ))}
          </ul>
        )}
      </>
    ),
    remainders: (
      <>
        <h3>Остатки:</h3>
        {result.remainders.length === 0 ? (
          <div className="stats-line">Нет</div>
        ) : (
          <ul className="remainders-list">
            {result.remainders.map((r) => (
              <li key={`${r.length}|${r.name || ''}`}>
                {fmt(r.length, 2)}
                {r.name ? ` «${r.name}»` : ''} — {r.count} шт.
              </li>
            ))}
          </ul>
        )}
      </>
    ),
    inputData: (
      <>
        <h3>Входные данные:</h3>
        <div className="stats-line">
          <strong>Заготовки</strong>
        </div>
        <ul className="remainders-list">
          {stocks
            .filter((s) => typeof s.length === 'number' && s.length > 0)
            .map((s) => (
              <li key={s.id}>
                {s.length}
                {s.quantity === '' ? ' — без лимита' : ` — ${s.quantity} шт.`}
                {s.name ? ` (${s.name})` : ''}
              </li>
            ))}
        </ul>
        <div className="stats-line">
          <strong>Отрезки</strong>
        </div>
        <ul className="remainders-list">
          {parts
            .filter((p) => partCalcLength(p) > 0 && typeof p.quantity === 'number')
            .map((p) => (
              <li key={p.id}>
                {partCalcLength(p)} — {p.quantity} шт.
                {p.name ? ` (${p.name})` : ''}
              </li>
            ))}
        </ul>
      </>
    ),
    bladeKerf: (
      <>
        <h3>Толщина лезвия:</h3>
        <div className="stats-line">
          {settings.bladeKerf} {settings.units}
        </div>
      </>
    ),
    jsonScheme: (
      <>
        <h3>Схема для программ:</h3>
        <pre className="text-scheme">{JSON.stringify(jsonPayload, null, 2)}</pre>
      </>
    ),
    developer: (
      <>
        <h3>О программе:</h3>
        <div className="stats-line">Локальный калькулятор оптимального раскроя</div>
      </>
    ),
  }

  return (
    <section className="result-inline" id="result-anchor">
      {settings.resultOrder.map((id) => {
        if (!settings.resultVisible[id]) return null
        const node = blocks[id]
        if (!node) return null
        return <div key={id}>{node}</div>
      })}
    </section>
  )
}
