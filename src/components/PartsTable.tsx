/** Таблица отрезков: длина, кол-во, название. */
import type { PartItem } from '../types'
import { uid } from '../types'
import { DecimalInput } from './DecimalInput'

type Props = {
  parts: PartItem[]
  onChange: (parts: PartItem[]) => void
}

export function PartsTable({ parts, onChange }: Props) {
  const update = (id: string, patch: Partial<PartItem>) => {
    onChange(parts.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const addRow = () => {
    onChange([...parts, { id: uid('p'), length: '', quantity: '', name: '' }])
  }

  const removeRow = (id: string) => {
    if (parts.length <= 1) {
      onChange([{ id: uid('p'), length: '', quantity: '', name: '' }])
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
            <th>Кол-во*</th>
            <th>Название</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {parts.map((row, index) => (
            <tr key={row.id}>
              <td className="row-num">{index + 1}</td>
              <td>
                <DecimalInput
                  value={row.length}
                  onChange={(length) => update(row.id, { length })}
                  meterLength
                  aria-label="Длина отрезка"
                />
              </td>
              <td>
                <DecimalInput
                  value={row.quantity}
                  onChange={(quantity) => update(row.id, { quantity })}
                  inputMode="numeric"
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
          ))}
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
