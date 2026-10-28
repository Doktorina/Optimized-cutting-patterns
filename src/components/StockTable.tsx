/** Таблица заготовок (склад длины). */
import { useEffect, useState } from 'react'
import type { StockItem } from '../types'
import { uid } from '../types'
import { DecimalInput } from './DecimalInput'

type Props = {
  stocks: StockItem[]
  onChange: (stocks: StockItem[]) => void
}

/** Очерёдность: черновик при вводе, чтобы при раскрытии панели значение не сбрасывалось. */
function PriorityInput({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState(() => String(value ?? 0))

  useEffect(() => {
    if (!focused) setText(String(value ?? 0))
  }, [value, focused])

  const commit = (raw: string) => {
    const t = raw.trim()
    if (t === '') {
      onChange(0)
      setText('0')
      return
    }
    const n = Number.parseInt(t, 10)
    if (!Number.isFinite(n) || n < 0) {
      setText(String(value ?? 0))
      return
    }
    onChange(n)
    setText(String(n))
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={focused ? text : String(value ?? 0)}
      onFocus={() => {
        setFocused(true)
        setText(String(value ?? 0))
      }}
      onBlur={() => {
        commit(text)
        setFocused(false)
      }}
      onChange={(e) => {
        const raw = e.target.value
        if (raw !== '' && !/^\d*$/.test(raw)) return
        setText(raw)
      }}
      aria-label="Очерёдность (приоритет)"
      title="1 — сначала, 2 — потом, 0 — без приоритета (в конце)"
    />
  )
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
            <th title="Сколько заготовок этой длины можно взять (пусто = без лимита)">
              Кол-во (лимит)
            </th>
            <th>Название</th>
            <th title="1 — сначала, 2 — потом, 0 — в конце">Очерёдность</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {stocks.map((row, index) => (
            <tr key={row.id}>
              <td className="row-num">{index + 1}</td>
              <td>
                <DecimalInput
                  value={row.length}
                  onChange={(length) => update(row.id, { length })}
                  aria-label="Длина заготовки"
                />
              </td>
              <td className="qty-cell">
                <DecimalInput
                  value={row.quantity}
                  onChange={(quantity) => {
                    if (quantity === '') {
                      update(row.id, { quantity: '' })
                      return
                    }
                    const q = Math.floor(Number(quantity))
                    update(row.id, { quantity: Number.isFinite(q) && q > 0 ? q : '' })
                  }}
                  inputMode="numeric"
                  aria-label="Лимит количества заготовок"
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
                <PriorityInput
                  value={typeof row.priority === 'number' ? row.priority : 0}
                  onChange={(priority) => update(row.id, { priority })}
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
          + Добавить заготовку
        </button>
      </div>
    </div>
  )
}
