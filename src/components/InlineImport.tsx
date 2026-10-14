/** Встроенная загрузка данных на странице линии (текст + Excel/CSV). */
import { useRef, useState } from 'react'
import {
  IMPORT_PART_EXAMPLE,
  IMPORT_STOCK_EXAMPLE,
  parseImportText,
  parseRowsAsParts,
  parseRowsAsStocks,
  parseSpreadsheetFile,
  withTrailingEmptyPart,
  withTrailingEmptyStock,
} from '../algorithm/parseImport'
import { useApp } from '../context/AppContext'

type Props = {
  open: boolean
  onClose: () => void
}

export function InlineImport({ open, onClose }: Props) {
  const { setStocks, setParts } = useApp()
  const [stockText, setStockText] = useState('')
  const [partText, setPartText] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const stockFileRef = useRef<HTMLInputElement>(null)
  const partFileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const applyStocks = (rows: ReturnType<typeof parseRowsAsStocks>) => {
    if (!rows.length) return false
    setStocks(withTrailingEmptyStock(rows))
    return true
  }

  const applyParts = (rows: ReturnType<typeof parseRowsAsParts>) => {
    if (!rows.length) return false
    setParts(withTrailingEmptyPart(rows))
    return true
  }

  const importStocksText = () => {
    const rows = parseRowsAsStocks(stockText)
    if (!applyStocks(rows)) {
      setError('Не распознаны заготовки. Формат строки: длина [количество] [название]')
      setStatus(null)
      return
    }
    setError(null)
    setStatus(`Заготовки: ${rows.length} строк`)
  }

  const importPartsText = () => {
    const rows = parseRowsAsParts(partText)
    if (!applyParts(rows)) {
      setError('Не распознаны отрезки. Формат строки: длина количество [название]')
      setStatus(null)
      return
    }
    setError(null)
    setStatus(`Отрезки: ${rows.length} строк`)
  }

  const importBothText = () => {
    const combined = [
      stockText.trim() ? `Заготовки\n${stockText.trim()}` : '',
      partText.trim() ? `Отрезки\n${partText.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    if (!combined) {
      setError('Вставьте данные в поля заготовок и/или отрезков')
      setStatus(null)
      return
    }
    const parsed = parseImportText(combined)
    const okS = applyStocks(parsed.stocks)
    const okP = applyParts(parsed.parts)
    if (!okS && !okP) {
      setError('Не удалось распознать данные')
      setStatus(null)
      return
    }
    setError(null)
    setStatus(
      [
        okS ? `заготовок ${parsed.stocks.length}` : null,
        okP ? `отрезков ${parsed.parts.length}` : null,
      ]
        .filter(Boolean)
        .join(', '),
    )
  }

  const handleFile = async (file: File | undefined, target: 'stocks' | 'parts' | 'auto') => {
    if (!file) return
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const parsed = await parseSpreadsheetFile(file, target)
      let stocks = parsed.stocks
      let parts = parsed.parts

      if (target === 'auto' && !stocks.length && !parts.length) {
        const fallback = await parseSpreadsheetFile(file, 'parts')
        parts = fallback.parts
        if (!parts.length) {
          const asStocks = await parseSpreadsheetFile(file, 'stocks')
          stocks = asStocks.stocks
        }
      }

      const okS =
        (target === 'stocks' || target === 'auto') && stocks.length ? applyStocks(stocks) : false
      const okP =
        (target === 'parts' || target === 'auto') && parts.length ? applyParts(parts) : false

      if (!okS && !okP) {
        setError(
          `В «${file.name}» нет данных. Нужны колонки: длина, количество, название (или строки «6000 10 …»).`,
        )
        return
      }
      setStatus(
        `«${file.name}»: ${[
          okS ? `заготовок ${stocks.length}` : null,
          okP ? `отрезков ${parts.length}` : null,
        ]
          .filter(Boolean)
          .join(', ')}`,
      )
    } catch {
      setError('Не удалось прочитать файл. Подходят Excel (.xlsx, .xls) и таблицы (.csv)')
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    void handleFile(file, 'auto')
  }

  return (
    <section className="inline-import" id="import">
      <header className="inline-import-head">
        <div>
          <strong>Загрузка данных</strong>
          <span>Вставка текста или файл Excel / таблица</span>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </header>

      <div
        className={`inline-import-drop${busy ? ' busy' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <p>
          Перетащите файл сюда или{' '}
          <button type="button" className="linkish" onClick={() => fileRef.current?.click()} disabled={busy}>
            выберите на диске
          </button>
        </p>
        <p className="hint">Авто-разбор: листы «Заготовки» / «Отрезки» или одна таблица с длинами</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,text/csv,.txt"
          hidden
          onChange={(e) => {
            void handleFile(e.target.files?.[0], 'auto')
            e.target.value = ''
          }}
        />
      </div>

      <div className="inline-import-grid">
        <div>
          <div className="inline-import-label">
            Заготовки
            <button type="button" className="linkish" onClick={() => setStockText(IMPORT_STOCK_EXAMPLE)}>
              пример
            </button>
          </div>
          <textarea
            value={stockText}
            onChange={(e) => setStockText(e.target.value)}
            placeholder={'6000 32\n5000 12 материал'}
            spellCheck={false}
            rows={5}
            aria-label="Текст заготовок"
          />
          <div className="inline-import-row">
            <button type="button" className="btn btn-blue btn-sm" onClick={importStocksText}>
              Вставить заготовки
            </button>
            <button
              type="button"
              className="btn btn-blue btn-sm"
              onClick={() => stockFileRef.current?.click()}
              disabled={busy}
            >
              Файл…
            </button>
            <input
              ref={stockFileRef}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,.txt"
              hidden
              onChange={(e) => {
                void handleFile(e.target.files?.[0], 'stocks')
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <div>
          <div className="inline-import-label">
            Отрезки
            <button type="button" className="linkish" onClick={() => setPartText(IMPORT_PART_EXAMPLE)}>
              пример
            </button>
          </div>
          <textarea
            value={partText}
            onChange={(e) => setPartText(e.target.value)}
            placeholder={'2920 7\n1900 5\n1180 10'}
            spellCheck={false}
            rows={5}
            aria-label="Текст отрезков"
          />
          <div className="inline-import-row">
            <button type="button" className="btn btn-blue btn-sm" onClick={importPartsText}>
              Вставить отрезки
            </button>
            <button
              type="button"
              className="btn btn-blue btn-sm"
              onClick={() => partFileRef.current?.click()}
              disabled={busy}
            >
              Файл…
            </button>
            <input
              ref={partFileRef}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,.txt"
              hidden
              onChange={(e) => {
                void handleFile(e.target.files?.[0], 'parts')
                e.target.value = ''
              }}
            />
          </div>
        </div>
      </div>

      <div className="inline-import-footer">
        <button type="button" className="btn btn-blue" onClick={importBothText}>
          Применить оба поля
        </button>
        {status && <span className="ok-hint">{status}</span>}
      </div>
      {error && <div className="error-box">{error}</div>}
    </section>
  )
}
