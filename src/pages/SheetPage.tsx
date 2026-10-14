/**
 * Раскрой листа (2D): размеры листа/деталей → solveSheetVariants → вкладки вариантов + превью.
 * Состояние локальное (не через AppContext).
 */
import { useEffect, useMemo, useState } from 'react'
import { solveSheetVariants, type PackVariant } from '../algorithm/sheetPack'
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
  { id: 'sp1', width: 600, height: 400, quantity: 4, name: 'A', allowRotate: true },
  { id: 'sp2', width: 800, height: 300, quantity: 3, name: 'B', allowRotate: true },
  { id: 'sp3', width: 450, height: 450, quantity: 2, name: 'C', allowRotate: false },
  { id: 'sp4', width: 350, height: 200, quantity: 6, name: 'D', allowRotate: true },
  { id: 'sp5', width: '', height: '', quantity: '', name: '', allowRotate: true },
]

function num(v: number | ''): number {
  return typeof v === 'number' && v > 0 ? v : 0
}

export function SheetPage() {
  const [sheetW, setSheetW] = useState(2800)
  const [sheetH, setSheetH] = useState(2070)
  const [sheetQty, setSheetQty] = useState<number | ''>('')
  const [sheetName, setSheetName] = useState('ЛДСП')
  const [kerf, setKerf] = useState(4)
  const [units, setUnits] = useState('мм')
  const [parts, setParts] = useState<PartRow[]>(DEMO_PARTS)
  const [variants, setVariants] = useState<PackVariant[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const active = useMemo(
    () => variants.find((v) => v.id === activeId) || variants[0] || null,
    [variants, activeId],
  )

  const fmtArea = (n: number) =>
    n.toLocaleString('ru-RU', { maximumFractionDigits: 0 })

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
    setParts((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)))
  }

  const parseOpt = (raw: string): number | '' => {
    if (raw.trim() === '') return ''
    const n = Number(raw.replace(',', '.'))
    return Number.isFinite(n) ? n : ''
  }

  const run = () => {
    if (sheetW <= 0 || sheetH <= 0) {
      setError('Укажите размеры листа (ширина и высота)')
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
    const tooBig = defs.find(
      (d) =>
        (d.width > sheetW || d.height > sheetH) &&
        (!d.allowRotate || d.width > sheetH || d.height > sheetW),
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
    )
    setError(null)
    setVariants(result)
    setActiveId(result[0]?.id ?? null)
  }

  useEffect(() => {
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при первом открытии
  }, [])

  return (
    <div className="page-card">
      <header className="page-head page-head-row">
        <div>
          <h1>Раскройка листа</h1>
          <p>
            Укажите размеры листа и деталей — сравните несколько вариантов укладки и посмотрите схему
            кроя.
          </p>
        </div>
        <button type="button" className="btn btn-green" onClick={run}>
          Посчитать варианты
        </button>
      </header>

      <section className="sheet-params">
        <h2 className="block-title">Лист</h2>
        <div className="settings-grid">
          <div className="field">
            <label htmlFor="sw">Ширина листа</label>
            <input
              id="sw"
              type="number"
              min={1}
              value={sheetW}
              onChange={(e) => setSheetW(Number(e.target.value) || 0)}
            />
          </div>
          <div className="field">
            <label htmlFor="sh">Высота листа</label>
            <input
              id="sh"
              type="number"
              min={1}
              value={sheetH}
              onChange={(e) => setSheetH(Number(e.target.value) || 0)}
            />
          </div>
          <div className="field">
            <label htmlFor="sq">Количество листов</label>
            <input
              id="sq"
              type="number"
              min={0}
              placeholder="без лимита"
              value={sheetQty}
              onChange={(e) => setSheetQty(parseOpt(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="sn">Название</label>
            <input id="sn" type="text" value={sheetName} onChange={(e) => setSheetName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="sk">Пропил (толщина лезвия)</label>
            <input
              id="sk"
              type="number"
              min={0}
              step="any"
              value={kerf}
              onChange={(e) => setKerf(Number(e.target.value) || 0)}
            />
          </div>
          <div className="field">
            <label htmlFor="su">Единицы</label>
            <input id="su" type="text" value={units} onChange={(e) => setUnits(e.target.value)} />
          </div>
        </div>
      </section>

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

      {error && <div className="error-box">{error}</div>}

      {variants.length > 0 && (
        <section className="sheet-variants">
          <h2 className="block-title">Варианты раскроя</h2>
          <p className="hint">
            Лучший вариант отмечен ★ и открыт сразу. Польза — доля площади листа, занятая деталями.
          </p>

          <div className="variant-tabs">
            {variants.map((v, i) => (
              <button
                key={v.id}
                type="button"
                className={`variant-tab${active?.id === v.id ? ' active' : ''}`}
                onClick={() => setActiveId(v.id)}
              >
                <strong>
                  {i === 0 ? '★ Лучший · ' : ''}
                  {v.title}
                </strong>
                <span>
                  листов: {v.sheetsUsed} · польза {v.totalUsefulPercent.toFixed(1)}%
                  {v.unplacedCount > 0 ? ` · не влезло: ${v.unplacedCount}` : ''}
                </span>
              </button>
            ))}
          </div>

          {active && (
            <div className="variant-body">
              <p className="hint">{active.description}</p>
              <div className="stats-line">
                Использовано листов: <strong>{active.sheetsUsed}</strong>
                {' · '}
                площадь листов: <strong>{fmtArea(active.totalSheetArea)}</strong> {units}²
              </div>
              <div className="stats-line">
                Полезная площадь: <strong>{fmtArea(active.totalPartsArea)}</strong> {units}²
              </div>
              <div className="stats-line">
                Польза: <strong>{active.totalUsefulPercent.toFixed(2)}%</strong>
              </div>
              <div className="stats-line">
                Отходы: <strong>{active.totalWastePercent.toFixed(2)}%</strong>
                {' '}({fmtArea(active.totalWasteArea)} {units}²)
              </div>

              {active.unplaced.length > 0 && (
                <>
                  <h3>Не размещено</h3>
                  <ul className="remainders-list">
                    {active.unplaced.map((u) => (
                      <li key={`${u.width}x${u.height}-${u.name}`}>
                        {u.width}×{u.height}
                        {u.name ? ` «${u.name}»` : ''} — {u.quantity} шт.
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <h3>Схемы листов</h3>
              <div className="sheet-preview-list">
                {active.sheets.map((sh, idx) => (
                  <SheetPreview key={idx} sheet={sh} index={idx} units={units} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
