/** Таблица отрезков: длина, длина2 (угол), кол-во, «В расчёт». */
import type { PartItem } from '../types'
import { partCalcLength, uid } from '../types'

type Props = {
  parts: PartItem[]
  onChange: (parts: PartItem[]) => void
}

function parseOptionalNumber(value: string): number | '' {
  if (value.trim() === '') return ''
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : ''
}

export function PartsTable({ parts, onChange }: Props) {
  const update = (id: string, patch: Partial<PartItem>) => {
    onChange(parts.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const addRow = () => {
    onChange([...parts, { id: uid('p'), length: '', length2: '', quantity: '', name: '' }])
  }

  const removeRow = (id: string) => {
    if (parts.length <= 1) {
      onChange([{ id: uid('p'), length: '', length2: '', quantity: '', name: '' }])
      return
    }
    onChange(parts.filter((p) => p.id !== id))
  }

  return (
    <div className="table-panel">
      <table className="data-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Длина*</th>
            <th>2‑я длина</th>
            <th>В расчёт</th>
            <th>Кол-во*</th>
            <th>Название</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {parts.map((row, index) => {
            const calc = partCalcLength(row)
            const angled =
              typeof row.length === 'number' &&
              row.length > 0 &&
              typeof row.length2 === 'number' &&
              row.length2 > 0
            return (
              <tr key={row.id}>
                <td className="row-num">{index + 1}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="79"
                    value={row.length}
                    onChange={(e) => update(row.id, { length: parseOptionalNumber(e.target.value) })}
                    aria-label="Длина отрезка"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="75"
                    value={row.length2 ?? ''}
                    onChange={(e) => update(row.id, { length2: parseOptionalNumber(e.target.value) })}
                    aria-label="Вторая длина торца под углом"
                  />
                </td>
                <td className="calc-len-cell" title={angled ? 'Средняя длина под углом' : 'Длина'}>
                  {calc > 0 ? calc : '—'}
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="7"
                    value={row.quantity}
                    onChange={(e) =>
                      update(row.id, { quantity: parseOptionalNumber(e.target.value) })
                    }
                    aria-label="Количество"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => update(row.id, { name: e.target.value })}
                    aria-label="Название"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => removeRow(row.id)}
                    aria-label="Удалить"
                  >
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="table-actions">
        <button type="button" className="btn btn-blue" onClick={addRow}>
          + Добавить отрезок
        </button>
      </div>
    </div>
  )
}
