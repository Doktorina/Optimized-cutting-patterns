/** Раскрой листа (2D). */
import { useMemo, useState } from 'react'
import {
  solveSheetVariants,
  type PackVariant,
  type SheetLayoutMode,
} from '../algorithm/sheetPack'
import { SheetPreview } from '../components/SheetPreview'
import { uid } from '../types'

type PartRow = {
  id: string
  width: number | ''
  height: number | ''
  quantity: number | ''
  name: string
  allowRotate: boolean
}

const DEMO_PARTS: PartRow[] = [
  { id: 'sp1', width: 750, height: 200, quantity: 10, name: '', allowRotate: true },
  { id: 'sp2', width: 350, height: 200, quantity: 18, name: '', allowRotate: true },
  { id: 'sp3', width: 200, height: 200, quantity: 14, name: '', allowRotate: true },
  { id: 'sp4', width: '', height: '', quantity: '', name: '', allowRotate: true },
]

function num(v: number | ''): number {
  return typeof v === 'number' && v > 0 ? v : 0
}

const LAYOUT_MODES: {
  id: SheetLayoutMode
  label: string
  icon: 'length' | 'width' | 'optimal'
}[] = [
  { id: 'length', label: 'По длине', icon: 'length' },
  { id: 'width', label: 'По ширине', icon: 'width' },
  { id: 'optimal', label: 'Оптимально', icon: 'optimal' },
]

function LayoutIcon({ kind }: { kind: 'length' | 'width' | 'optimal' }) {
  if (kind === 'length') {
    return (
      <svg viewBox="0 0 48 36" className="layout-mode-svg" aria-hidden>
        <rect x="4" y="6" width="40" height="8" rx="1" fill="#c5d4e8" stroke="#4a6fa5" />
        <rect x="4" y="16" width="28" height="8" rx="1" fill="#c5d4e8" stroke="#4a6fa5" />
        <rect x="4" y="26" width="34" height="6" rx="1" fill="#c5d4e8" stroke="#4a6fa5" />
      </svg>
    )
  }
  if (kind === 'width') {
    return (
      <svg viewBox="0 0 48 36" className="layout-mode-svg" aria-hidden>
        <rect x="4" y="4" width="10" height="28" rx="1" fill="#c5d4e8" stroke="#4a6fa5" />
        <rect x="16" y="4" width="10" height="20" rx="1" fill="#c5d4e8" stroke="#4a6fa5" />
        <rect x="28" y="4" width="10" height="24" rx="1" fill="#c5d4e8" stroke="#4a6fa5" />
        <rect x="40" y="4" width="6" height="14" rx="1" fill="#c5d4e8" stroke="#4a6fa5" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 48 36" className="layout-mode-svg" aria-hidden>
      <rect x="4" y="4" width="18" height="12" rx="1" fill="#c5d4e8" stroke="#4a6fa5" />
      <rect x="24" y="4" width="10" height="20" rx="1" fill="#c5d4e8" stroke="#4a6fa5" />
      <rect x="36" y="4" width="8" height="10" rx="1" fill="#c5d4e8" stroke="#4a6fa5" />
      <rect x="4" y="18" width="12" height="14" rx="1" fill="#c5d4e8" stroke="#4a6fa5" />
      <rect x="18" y="26" width="16" height="6" rx="1" fill="#c5d4e8" stroke="#4a6fa5" />
      <rect x="36" y="16" width="8" height="16" rx="1" fill="#c5d4e8" stroke="#4a6fa5" />
    </svg>
  )
}

export function SheetPage() {
  const [sheetW, setSheetW] = useState(2000)
  const [sheetH, setSheetH] = useState(1000)
  const [sheetQty, setSheetQty] = useState<number | ''>('')
  const [sheetName, setSheetName] = useState('ЛДСП')
  const [kerf, setKerf] = useState(4)
  const [margin, setMargin] = useState(0)
  const [units, setUnits] = useState('мм')
  const [layoutMode, setLayoutMode] = useState<SheetLayoutMode>('optimal')
  const [parts, setParts] = useState<PartRow[]>(DEMO_PARTS)
  const [variants, setVariants] = useState<PackVariant[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeSheetIdx, setActiveSheetIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showQty, setShowQty] = useState(false)

  const active = useMemo(
    () => variants.find((v) => v.id === activeId) || variants[0] || null,
    [variants, activeId],
  )

  const activeSheet = active?.sheets[activeSheetIdx] || active?.sheets[0] || null

  const updatePart = (id: string, patch: Partial<PartRow>) => {
    setParts((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const addPart = () => {
    setParts((rows) => [
      ...rows,
      { id: uid('sp'), width: '', height: '', quantity: '', name: '', allowRotate: true },
    ])
  }

  const removePart = (id: string) => {
    setParts((rows) => {
      if (rows.length <= 1) {
        return [{ id: uid('sp'), width: '', height: '', quantity: '', name: '', allowRotate: true }]
      }
      return rows.filter((r) => r.id !== id)
    })
  }

  const parseOpt = (raw: string): number | '' => {
    if (raw.trim() === '') return ''
    const n = Number(raw.replace(',', '.'))
    return Number.isFinite(n) ? n : ''
  }

  const run = () => {
    if (sheetW <= 0 || sheetH <= 0) {
      setError('Укажите размеры листа (длина и ширина)')
      setVariants([])
      return
    }
    const defs = parts
      .filter((p) => num(p.width) > 0 && num(p.height) > 0 && num(p.quantity) > 0)
      .map((p) => ({
        id: p.id,
        width: num(p.width),
        height: num(p.height),
        quantity: num(p.quantity),
        name: p.name,
        allowRotate: p.allowRotate,
      }))
    if (!defs.length) {
      setError('Добавьте хотя бы одну деталь с шириной, высотой и количеством')
      setVariants([])
      return
    }
    const usableW = sheetW - 2 * Math.max(0, margin)
    const usableH = sheetH - 2 * Math.max(0, margin)
    if (usableW <= 0 || usableH <= 0) {
      setError('Отступ слишком большой для размеров листа')
      setVariants([])
      return
    }
    const tooBig = defs.find(
      (d) =>
        (d.width > usableW || d.height > usableH) &&
        (!d.allowRotate || d.width > usableH || d.height > usableW),
    )
    if (tooBig) {
      setError(
        `Деталь «${tooBig.name || tooBig.width + '×' + tooBig.height}» не помещается на лист ${sheetW}×${sheetH}`,
      )
      setVariants([])
      return
    }

    const result = solveSheetVariants(
      {
        width: sheetW,
        height: sheetH,
        quantity: sheetQty === '' ? null : sheetQty,
        name: sheetName,
      },
      defs,
      Math.max(0, kerf),
      { margin: Math.max(0, margin), mode: layoutMode },
    )
    setError(null)
    setVariants(result)
    setActiveId(result[0]?.id ?? null)
    setActiveSheetIdx(0)
  }

  const cutLengthMm = active
    ? active.sheets.reduce(
        (s, sh) => s + sh.parts.reduce((ps, p) => ps + p.width + p.height, 0),
        0,
      )
    : 0
  const cutLengthDisplay =
    units === 'мм' || units.toLowerCase() === 'mm'
      ? `${(cutLengthMm / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м`
      : `${cutLengthMm.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ${units}`

  const areaM2 = (n: number) => {
    const m2 = units === 'мм' || units.toLowerCase() === 'mm' ? n / 1_000_000 : n
    return `${m2.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} м.кв.`
  }

  return (
    <div className="page-card">
      <header className="page-head page-head-row">
        <div>
          <h1>Раскройка листа</h1>
          <p>Размеры листа, детали и схема раскроя.</p>
        </div>
      </header>

      <section className="sheet-parts">
        <h2 className="block-title">Детали</h2>
        <div className="table-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Ширина*</th>
                <th>Высота*</th>
                <th>Кол-во*</th>
                <th>Название</th>
                <th>Поворот</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {parts.map((row, i) => (
                <tr key={row.id}>
                  <td className="row-num">{i + 1}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={row.width}
                      onChange={(e) => updatePart(row.id, { width: parseOpt(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={row.height}
                      onChange={(e) => updatePart(row.id, { height: parseOpt(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={row.quantity}
                      onChange={(e) => updatePart(row.id, { quantity: parseOpt(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => updatePart(row.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={row.allowRotate}
                        onChange={(e) => updatePart(row.id, { allowRotate: e.target.checked })}
                      />
                      90°
                    </label>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => removePart(row.id)}
                      aria-label="Удалить"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-actions">
            <button type="button" className="btn btn-blue" onClick={addPart}>
              + Добавить деталь
            </button>
          </div>
        </div>
      </section>

      <section className="sheet-cut-panel" aria-label="Параметры раскроя">
        <h2 className="block-title">Параметры раскроя</h2>

        <div className="sheet-size-row">
          <span className="sheet-size-label">Размер листа</span>
          <div className="sheet-size-fields">
            <label className="field field-inline">
              <span>Длина</span>
              <input
                type="number"
                min={1}
                value={sheetW}
                onChange={(e) => setSheetW(Number(e.target.value) || 0)}
              />
            </label>
            <span className="sheet-size-x" aria-hidden>
              ×
            </span>
            <label className="field field-inline">
              <span>Ширина</span>
              <input
                type="number"
                min={1}
                value={sheetH}
                onChange={(e) => setSheetH(Number(e.target.value) || 0)}
              />
            </label>
            <button type="button" className="btn btn-blue" onClick={() => setShowQty((v) => !v)}>
              Листы
            </button>
          </div>
        </div>

        {showQty && (
          <div className="sheet-extra-row">
            <label className="field">
              <span>Количество листов</span>
              <input
                type="number"
                min={0}
                placeholder="без лимита"
                value={sheetQty}
                onChange={(e) => setSheetQty(parseOpt(e.target.value))}
              />
            </label>
            <label className="field">
              <span>Название</span>
              <input type="text" value={sheetName} onChange={(e) => setSheetName(e.target.value)} />
            </label>
            <label className="field">
              <span>Единицы</span>
              <input type="text" value={units} onChange={(e) => setUnits(e.target.value)} />
            </label>
          </div>
        )}

        <div className="sheet-extra-row">
          <label className="field">
            <span>Ширина реза</span>
            <input
              type="number"
              min={0}
              step="any"
              value={kerf}
              onChange={(e) => setKerf(Number(e.target.value) || 0)}
            />
          </label>
          <label className="field">
            <span>Отступ от края листа</span>
            <input
              type="number"
              min={0}
              step="any"
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value) || 0)}
            />
          </label>
        </div>

        <div className="layout-modes" role="radiogroup" aria-label="Режим укладки">
          {LAYOUT_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={layoutMode === m.id}
              className={`layout-mode${layoutMode === m.id ? ' active' : ''}`}
              onClick={() => setLayoutMode(m.id)}
            >
              <LayoutIcon kind={m.icon} />
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <div className="sheet-cut-actions">
          <button type="button" className="btn btn-green sheet-cut-btn" onClick={run}>
            Раскроить
          </button>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      {active && (
        <section className="sheet-result">
          <h2 className="block-title">Результаты</h2>

          <div className="sheet-stats-table">
            <div className="sheet-stats-col">
              <div>
                <span>Площадь листов</span>
                <strong>{areaM2(active.totalSheetArea)}</strong>
              </div>
              <div>
                <span>Кол-во листов</span>
                <strong>{active.sheetsUsed}</strong>
              </div>
              <div>
                <span>Длина резов</span>
                <strong>{cutLengthDisplay}</strong>
              </div>
            </div>
            <div className="sheet-stats-col">
              <div>
                <span>Площадь отходов</span>
                <strong>{areaM2(active.totalWasteArea)}</strong>
              </div>
              <div>
                <span>Польза</span>
                <strong>{active.totalUsefulPercent.toFixed(1)}%</strong>
              </div>
              <div>
                <span>Отходы</span>
                <strong>{active.totalWastePercent.toFixed(1)}%</strong>
              </div>
            </div>
          </div>

          {variants.length > 1 && (
            <div className="variant-tabs">
              {variants.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  className={`variant-tab${active.id === v.id ? ' active' : ''}`}
                  onClick={() => {
                    setActiveId(v.id)
                    setActiveSheetIdx(0)
                  }}
                >
                  <strong>
                    {i === 0 ? '★ ' : ''}
                    {v.title}
                  </strong>
                  <span>
                    листов: {v.sheetsUsed} · польза {v.totalUsefulPercent.toFixed(1)}%
                    {v.unplacedCount > 0 ? ` · не влезло: ${v.unplacedCount}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}

          {active.unplaced.length > 0 && (
            <div className="error-box" style={{ marginTop: 12 }}>
              Не размещено:{' '}
              {active.unplaced
                .map(
                  (u) =>
                    `${u.width}×${u.height}${u.name ? ` «${u.name}»` : ''} — ${u.quantity} шт.`,
                )
                .join('; ')}
            </div>
          )}

          <div className="sheet-workspace">
            <aside className="sheet-thumbs" aria-label="Листы">
              <div className="sheet-thumbs-head">Листы</div>
              {active.sheets.map((sh, idx) => (
                <SheetPreview
                  key={idx}
                  sheet={sh}
                  index={idx}
                  units={units}
                  compact
                  selected={idx === activeSheetIdx}
                  onSelect={() => setActiveSheetIdx(idx)}
                />
              ))}
            </aside>
            <div className="sheet-main-view">
              {activeSheet && (
                <SheetPreview
                  sheet={activeSheet}
                  index={activeSheetIdx}
                  units={units}
                />
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
