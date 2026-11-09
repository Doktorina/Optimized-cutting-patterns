/**
 * Печать и PDF результата линейного раскроя (как в SmartCut, бренд «Раскрой»).
 */
import { sizesFromZero, textScheme } from '../components/CuttingMap'
import type { PartItem, Settings, SolveResult, StockItem } from '../types'
import { partCalcLength, roundLen } from '../types'

function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '—'
  const r = Math.round(n * 10 ** digits) / 10 ** digits
  return String(r)
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function mapBarsHtml(result: SolveResult, settings: Settings): string {
  return result.grouped
    .map((g, gi) => {
      const { pattern, count, startIndex, endIndex } = g
      const title = settings.numberLayout
        ? count > 1
          ? `№ ${gi + 1}, # ${startIndex}–${endIndex}`
          : `№ ${gi + 1}, # ${startIndex}`
        : `Схема ${gi + 1}`
      const stockName = (pattern.stockName || '').trim()
      const parts = pattern.parts
      const total = Math.max(pattern.stockLength, 1e-9)
      const cells = parts
        .map((p) => {
          const pct = (p.length / total) * 100
          const label = (p.name || '').trim()
            ? `${fmt(p.length, 3)} ${esc(p.name)}`
            : fmt(p.length, 3)
          return `<td class="seg" style="width:${pct}%">${label}</td>`
        })
        .join('')
      const wasteCell =
        pattern.waste > 0
          ? `<td class="waste" style="width:${(pattern.waste / total) * 100}%">(${fmt(pattern.waste, 3)})</td>`
          : ''
      let acc = 0
      const marks = parts
        .map((p) => {
          acc = roundLen(acc + p.length)
          const pct = (p.length / total) * 100
          return `<td style="width:${pct}%">${fmt(acc, 3)}</td>`
        })
        .join('')
      const endMark =
        pattern.waste > 0
          ? `<td style="width:${(pattern.waste / total) * 100}%">${fmt(pattern.stockLength, 3)}</td>`
          : ''
      return `
      <div class="map-block">
        <div class="meta"><b>${esc(title)}</b> · Заготовок: ${count} шт. × ${fmt(pattern.stockLength, 3)}${
          stockName ? ` «${esc(stockName)}»` : ''
        } · отрезков: ${parts.length}</div>
        <table class="bar"><tr>${cells}${wasteCell}</tr>
        <tr class="marks">${marks}${endMark}</tr></table>
      </div>`
    })
    .join('')
}

export function buildResultReportHtml(opts: {
  result: SolveResult
  settings: Settings
  stocks: StockItem[]
  parts: PartItem[]
  cuttingName: string
}): string {
  const { result, settings, stocks, parts, cuttingName } = opts
  const date = new Date().toLocaleString('ru-RU')
  const name = (cuttingName || '').trim() || 'Схема раскроя'

  const stocksUsed = result.stocksUsed
    .map(
      (s) =>
        `${fmt(s.length, 3)} × ${s.count} шт.${s.name ? ` ${esc(s.name)}` : ''} = ${fmt(s.totalLength, 3)}`,
    )
    .join('<br/>')

  const remainders =
    result.remainders.length === 0
      ? 'Нет'
      : result.remainders
          .map(
            (r) =>
              `${fmt(r.length, 3)}${r.name ? ` «${esc(r.name)}»` : ''} — ${r.count} шт.`,
          )
          .join('<br/>')

  const usefulRem = result.remainders.filter(
    (r) => r.length >= (settings.usefulRemainderMin || 0) && r.length > 0,
  )
  const usefulRemHtml =
    usefulRem.length === 0
      ? 'Нет'
      : usefulRem
          .map(
            (r) =>
              `${fmt(r.length, 3)}${r.name ? ` «${esc(r.name)}»` : ''} — ${r.count} шт.`,
          )
          .join('<br/>')

  const inStocks = stocks
    .filter((s) => typeof s.length === 'number' && s.length > 0)
    .map(
      (s) =>
        `${s.length}${s.quantity === '' ? ' — без лимита' : ` — ${s.quantity} шт.`}${
          s.name ? ` (${esc(s.name)})` : ''
        }`,
    )
    .join('<br/>')

  const inParts = parts
    .filter((p) => partCalcLength(p) > 0 && typeof p.quantity === 'number')
    .map(
      (p) =>
        `${partCalcLength(p)} — ${p.quantity} шт.${p.name ? ` (${esc(p.name)})` : ''}`,
    )
    .join('<br/>')

  const schemeText = esc(textScheme(result.grouped, settings)).replace(/\n/g, '<br/>')
  const sizesText = esc(sizesFromZero(result.grouped, settings)).replace(/\n/g, '<br/>')

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<title>${esc(name)} — Раскрой</title>
<style>
  @page { margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    font-size: 12px;
    color: #1c2430;
    line-height: 1.45;
    margin: 0;
    padding: 16px 20px 28px;
  }
  .brand {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 2px solid #2a78c9;
    padding-bottom: 8px;
    margin-bottom: 14px;
  }
  .brand h1 { margin: 0; font-size: 20px; color: #1a4f8a; }
  .brand .sub { color: #5a6a7a; font-size: 11px; }
  h2 { font-size: 13px; margin: 16px 0 6px; color: #1a4f8a; }
  .stats { margin: 0 0 8px; }
  .stats div { margin: 2px 0; }
  .mono {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 11px;
    background: #f5f8fb;
    border: 1px solid #d5dde6;
    border-radius: 4px;
    padding: 8px 10px;
    white-space: pre-wrap;
  }
  .map-block { margin: 0 0 12px; page-break-inside: avoid; }
  .map-block .meta { margin-bottom: 4px; color: #445; font-size: 11px; }
  table.bar { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.bar td.seg {
    border: 1px solid #7aa7d6;
    background: #cfe4f8;
    text-align: center;
    padding: 6px 2px;
    font-size: 10px;
    overflow: hidden;
  }
  table.bar td.waste {
    border: 1px solid #ccc;
    background: #f0f0f0;
    color: #666;
    text-align: center;
    font-size: 9px;
    padding: 4px 1px;
  }
  table.bar tr.marks td {
    border: 0;
    background: transparent;
    color: #667;
    font-size: 9px;
    text-align: center;
    padding-top: 2px;
  }
  .footer {
    margin-top: 18px;
    padding-top: 8px;
    border-top: 1px solid #d5dde6;
    color: #6a7a8a;
    font-size: 10px;
  }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="brand">
    <div>
      <h1>Раскрой</h1>
      <div class="sub">Оптимизированные схемы раскроя</div>
    </div>
    <div class="sub">${esc(date)}</div>
  </div>

  <h2>${esc(name)}</h2>

  <h2>Использовано заготовок</h2>
  <div class="stats">
    <div>${stocksUsed || '—'}</div>
    <div>Польза: ${fmt(result.usefulPercent, 3)}%</div>
    <div>Остатки: ${fmt(result.wastePercent, 3)}% (${fmt(result.wasteLength, 2)})</div>
    <div>Количество разрезов: ${result.cutCount}</div>
    <div>Пропил: ${fmt(settings.bladeKerf, 3)} ${esc(settings.units || '')}</div>
  </div>

  <h2>Схема раскроя</h2>
  ${mapBarsHtml(result, settings)}

  <h2>Схема в текстовом формате</h2>
  <div class="mono">${schemeText}</div>

  <h2>Размеры от нуля</h2>
  <div class="mono">${sizesText}</div>

  <h2>Полезные остатки</h2>
  <div class="stats">${usefulRemHtml}</div>

  <h2>Остатки</h2>
  <div class="stats">${remainders}</div>

  <h2>Входные данные</h2>
  <div class="stats">
    <div><b>Заготовки</b></div>
    <div>${inStocks || '—'}</div>
    <div style="margin-top:8px"><b>Отрезки</b></div>
    <div>${inParts || '—'}</div>
  </div>

  <div class="footer">Раскрой · локальный калькулятор оптимального раскроя</div>
  <script>
    window.addEventListener('load', function () {
      if (window.__RASKROY_AUTOPRINT__) {
        setTimeout(function () { window.focus(); window.print(); }, 250);
      }
    });
  </script>
</body>
</html>`
}

function openReportWindow(html: string, autoprint: boolean): void {
  const payload = autoprint
    ? html.replace(
        '</head>',
        '<script>window.__RASKROY_AUTOPRINT__=true;</script></head>',
      )
    : html

  // Blob URL надёжнее document.write + noopener (иначе Chrome открывает пустой about:blank)
  const blob = new Blob([payload], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank', 'width=960,height=800')
  if (!w) {
    URL.revokeObjectURL(url)
    window.alert('Разрешите всплывающие окна, чтобы печатать или сохранить PDF.')
    return
  }
  w.addEventListener(
    'load',
    () => {
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },
    { once: true },
  )
}

type ReportOpts = {
  result: SolveResult
  settings: Settings
  stocks: StockItem[]
  parts: PartItem[]
  cuttingName: string
}

export function printCuttingResult(opts: ReportOpts): void {
  openReportWindow(buildResultReportHtml(opts), true)
}

/** PDF: окно печати — выберите «Сохранить как PDF» / Microsoft Print to PDF. */
export function saveCuttingResultPdf(opts: ReportOpts): void {
  openReportWindow(buildResultReportHtml(opts), true)
}
