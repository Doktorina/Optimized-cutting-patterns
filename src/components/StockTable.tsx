/** Таблица заготовок (склад длины). */
import type { StockItem } from '../types'
import { uid } from '../types'

type Props = {
  stocks: StockItem[]
  onChange: (stocks: StockItem[]) => void
}

function parseOptionalNumber(value: string): number | '' {
  const cleaned = value.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '') return ''
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : ''
}

export function StockTable({ stocks, onChange }: Props) {
  const update = (id: string, patch: Partial<StockItem>) => {
    onChange(stocks.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const addRow = () => {
    onChange([...stocks, { id: uid('s'), length: '', quantity: '', name: '', priority: 0 }])
  }

  const removeRow = (id: string) => {
    if (stocks.length <= 1) {
      onChange([{ id: uid('s'), length: '', quantity: '', name: '', priority: 0 }])
      return
    }
    onChange(stocks.filter((s) => s.id !== id))
  }

  return (
    <div className="table-panel">
      <table className="data-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Длина заготовки*</th>
            <th>Количество</th>
            <th>Название</th>
            <th>Очерёдность</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {stocks.map((row, index) => (
            <tr key={row.id}>
              <td className="row-num">{index + 1}</td>
              <td>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder=""
                  value={row.length === '' ? '' : String(row.length).replace('.', ',')}
                  onChange={(e) => update(row.id, { length: parseOptionalNumber(e.target.value) })}
                />
              </td>
              <td className="qty-cell">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder=""
                  value={row.quantity === '' ? '' : String(row.quantity)}
                  onChange={(e) => update(row.id, { quantity: parseOptionalNumber(e.target.value) })}
                />
                {row.quantity === '' && <span className="qty-infinite">без лимита</span>}
              </td>
              <td>
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => update(row.id, { name: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  step={1}
                  value={row.priority}
                  onChange={(e) => update(row.id, { priority: Number(e.target.value) || 0 })}
                />
              </td>
              <td>
                <button type="button" className="btn btn-ghost" onClick={() => removeRow(row.id)} aria-label="Удалить">
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-actions">
        <button type="button" className="btn btn-blue" onClick={addRow}>
          + Добавить заготовку
        </button>
      </div>
    </div>
  )
}
