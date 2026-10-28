/**
 * Главная страница линейного раскроя (одна прокрутка):
 * заготовки → отрезки → кнопка «Раскрой» → результат.
 * Якоря: #parts, #result, #import (открывает панель InlineImport).
 */
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { InlineImport } from '../components/InlineImport'
import { PartsTable } from '../components/PartsTable'
import { ResultPanel } from '../components/ResultPanel'
import { StockTable } from '../components/StockTable'
import { useApp } from '../context/AppContext'

function qtySum(values: Array<number | '' | string>): number {
  return values.reduce<number>((s, v) => {
    const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'))
    return s + (Number.isFinite(n) && n > 0 ? n : 0)
  }, 0)
}

export function StocksPage() {
  const {
    stocks,
    setStocks,
    parts,
    setParts,
    calculate,
    calculating,
    result,
    error,
    settings,
    cuttingName,
    setCuttingName,
    saveHistory,
  } = useApp()

  const location = useLocation()
  const resultRef = useRef<HTMLElement | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    const hash = location.hash
    if (hash === '#import') setImportOpen(true)
    const id =
      hash === '#parts' ? 'parts' : hash === '#result' ? 'result' : hash === '#import' ? 'import' : null
    if (!id) return
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 40)
    return () => window.clearTimeout(t)
  }, [location.hash, location.key, result, error, calculating])

  const stockQty = qtySum(stocks.map((s) => s.quantity))
  const partQty = qtySum(parts.map((p) => p.quantity))
  const hasInfiniteStock = stocks.some(
    (s) => s.quantity === '' && typeof s.length === 'number' && s.length > 0,
  )

  return (
    <div className="page-card">
      <header className="page-head page-head-row">
        <div>
          <h1>Линия раскройки</h1>
          <p>Заготовки, отрезки и результат — на одном экране.</p>
        </div>
        <div className="page-head-actions">
          <button
            type="button"
            className={`btn btn-blue${importOpen ? ' active-toggle' : ''}`}
            onClick={() => setImportOpen((v) => !v)}
            aria-expanded={importOpen}
          >
            {importOpen ? 'Скрыть загрузку' : 'Загрузить'}
          </button>
          <button type="button" className="btn btn-green" onClick={calculate} disabled={calculating}>
            {calculating ? 'Расчёт…' : 'Раскрой'}
          </button>
        </div>
      </header>

      <InlineImport open={importOpen} onClose={() => setImportOpen(false)} />

      <section className="data-section" id="stocks">
        <header className="data-section-head">
          <h2>Заготовки / Склад</h2>
          <span className="data-section-meta">
            кол-во: {hasInfiniteStock ? `${stockQty || 0}+` : stockQty}
            {hasInfiniteStock ? ' без лимита' : ''}
          </span>
        </header>
        <p className="data-section-hint">
          Заготовки вручную. Кол-во — сколько максимум взять (20 = не больше 20 шт.); пусто = без
          лимита. Очерёдность 1 режется раньше 2; 0 — в конце.
        </p>
        <StockTable stocks={stocks} onChange={setStocks} />
      </section>

      <section className="data-section" id="parts">
        <header className="data-section-head">
          <h2>Отрезки</h2>
          <span className="data-section-meta">кол-во: {partQty}</span>
        </header>
        <p className="data-section-hint">
          Загружаются из файла. Целые вроде 3115 читаются как 3,115 (три знака после запятой).
        </p>
        <PartsTable parts={parts} onChange={setParts} />
      </section>

      <div className="page-footer-actions">
        <button type="button" className="btn btn-green" onClick={calculate} disabled={calculating}>
          {calculating ? 'Расчёт…' : 'Раскрой'}
        </button>
      </div>

      <section className="data-section result-section" id="result" ref={resultRef}>
        <header className="data-section-head data-section-head-result">
          <h2>Результат</h2>
          {result && !error && (
            <div className="data-section-actions">
              <button type="button" className="btn btn-on-blue" onClick={saveHistory}>
                В историю
              </button>
              <button
                type="button"
                className="btn btn-on-blue"
                onClick={calculate}
                disabled={calculating}
              >
                {calculating ? 'Расчёт…' : 'Пересчитать'}
              </button>
            </div>
          )}
        </header>

        <div className="result-section-body">
          {error && !result && (
            <div className="error-box">
              {error}
              <div className="import-actions" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-green" onClick={calculate} disabled={calculating}>
                  {calculating ? 'Расчёт…' : 'Повторить раскрой'}
                </button>
                <button type="button" className="btn btn-blue" onClick={() => setImportOpen(true)}>
                  Загрузить данные
                </button>
              </div>
            </div>
          )}

          {!result && !error && (
            <div className="empty-state-box compact">
              <p>Нажмите «Раскрой» — схема появится здесь, без перехода на другую страницу.</p>
            </div>
          )}

          {result && (
            <ResultPanel
              result={result}
              settings={settings}
              stocks={stocks}
              parts={parts}
              cuttingName={cuttingName}
              onCuttingNameChange={setCuttingName}
              error={null}
            />
          )}
        </div>
      </section>
    </div>
  )
}
