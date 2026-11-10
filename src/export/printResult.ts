/**
 * Печать и PDF результата линейного раскроя (бренд «Раскрой»).
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

let pdfFontsPromise: Promise<{ regular: string; bold: string }> | null = null

async function loadPdfFonts(): Promise<{ regular: string; bold: string }> {
  if (!pdfFontsPromise) {
    pdfFontsPromise = Promise.all([
      fetch('/fonts/DejaVuSans.ttf').then((r) => {
        if (!r.ok) throw new Error('Не удалось загрузить шрифт DejaVuSans')
        return r.arrayBuffer()
      }),
      fetch('/fonts/DejaVuSans-Bold.ttf').then((r) => {
        if (!r.ok) throw new Error('Не удалось загрузить шрифт DejaVuSans-Bold')
        return r.arrayBuffer()
      }),
    ]).then(([regular, bold]) => ({
      regular: arrayBufferToBase64(regular),
      bold: arrayBufferToBase64(bold),
    }))
  }
  return pdfFontsPromise
}

function safeFileName(name: string): string {
  const base = (name || 'raskroy').trim() || 'raskroy'
  return (
    base
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'raskroy'
  )
}

/** Скачивание настоящего PDF-файла (без диалога печати). */
export async function saveCuttingResultPdf(opts: ReportOpts): Promise<void> {
  const { result, settings, stocks, parts, cuttingName } = opts
  const { jsPDF } = await import('jspdf')
  const fonts = await loadPdfFonts()

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  doc.addFileToVFS('DejaVuSans.ttf', fonts.regular)
  doc.addFileToVFS('DejaVuSans-Bold.ttf', fonts.bold)
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal')
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold')

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentW = pageW - margin * 2
  let y = margin

  const ensureSpace = (need: number) => {
    if (y + need <= pageH - margin) return
    doc.addPage()
    y = margin
  }

  const setNormal = (size = 10) => {
    doc.setFont('DejaVuSans', 'normal')
    doc.setFontSize(size)
    doc.setTextColor(28, 36, 48)
  }
  const setBold = (size = 10) => {
    doc.setFont('DejaVuSans', 'bold')
    doc.setFontSize(size)
    doc.setTextColor(26, 79, 138)
  }

  const writeWrapped = (text: string, size = 10, gap = 4.2) => {
    setNormal(size)
    const lines = doc.splitTextToSize(text, contentW) as string[]
    for (const line of lines) {
      ensureSpace(gap)
      doc.text(line, margin, y)
      y += gap
    }
  }

  const writeHeading = (text: string) => {
    ensureSpace(10)
    y += 2
    setBold(12)
    doc.text(text, margin, y)
    y += 6
  }

  const date = new Date().toLocaleString('ru-RU')
  const name = (cuttingName || '').trim() || 'Схема раскроя'

  setBold(18)
  doc.text('Раскрой', margin, y)
  setNormal(9)
  doc.setTextColor(90, 106, 122)
  doc.text('Оптимизированные схемы раскроя', margin, y + 6)
  doc.text(date, pageW - margin, y, { align: 'right' })
  y += 10
  doc.setDrawColor(42, 120, 201)
  doc.setLineWidth(0.6)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  setBold(13)
  doc.text(name, margin, y)
  y += 8

  writeHeading('Использовано заготовок')
  const stocksUsed =
    result.stocksUsed.length === 0
      ? '—'
      : result.stocksUsed
          .map(
            (s) =>
              `${fmt(s.length, 3)} × ${s.count} шт.${s.name ? ` ${s.name}` : ''} = ${fmt(s.totalLength, 3)}`,
          )
          .join('\n')
  writeWrapped(stocksUsed)
  writeWrapped(`Польза: ${fmt(result.usefulPercent, 3)}%`)
  writeWrapped(
    `Остатки: ${fmt(result.wastePercent, 3)}% (${fmt(result.wasteLength, 2)})`,
  )
  writeWrapped(`Количество разрезов: ${result.cutCount}`)
  writeWrapped(`Пропил: ${fmt(settings.bladeKerf, 3)} ${settings.units || ''}`.trim())

  writeHeading('Схема раскроя')
  for (let gi = 0; gi < result.grouped.length; gi++) {
    const g = result.grouped[gi]
    const { pattern, count, startIndex, endIndex } = g
    const title = settings.numberLayout
      ? count > 1
        ? `№ ${gi + 1}, # ${startIndex}–${endIndex}`
        : `№ ${gi + 1}, # ${startIndex}`
      : `Схема ${gi + 1}`
    const stockName = (pattern.stockName || '').trim()
    const meta = `${title} · Заготовок: ${count} шт. × ${fmt(pattern.stockLength, 3)}${
      stockName ? ` «${stockName}»` : ''
    } · отрезков: ${pattern.parts.length}`

    ensureSpace(22)
    setNormal(9)
    doc.setTextColor(68, 68, 85)
    doc.text(meta, margin, y)
    y += 4

    const barH = 8
    const total = Math.max(pattern.stockLength, 1e-9)
    let x = margin
    for (const p of pattern.parts) {
      const w = (p.length / total) * contentW
      doc.setFillColor(207, 228, 248)
      doc.setDrawColor(122, 167, 214)
      doc.rect(x, y, Math.max(w, 0.2), barH, 'FD')
      const label = (p.name || '').trim()
        ? `${fmt(p.length, 3)} ${p.name}`
        : fmt(p.length, 3)
      if (w > 8) {
        setNormal(7)
        doc.setTextColor(28, 36, 48)
        const clipped = doc.splitTextToSize(label, w - 1) as string[]
        doc.text(clipped[0] || '', x + w / 2, y + 5.2, { align: 'center' })
      }
      x += w
    }
    if (pattern.waste > 0) {
      const w = (pattern.waste / total) * contentW
      doc.setFillColor(240, 240, 240)
      doc.setDrawColor(200, 200, 200)
      doc.rect(x, y, Math.max(w, 0.2), barH, 'FD')
      if (w > 8) {
        setNormal(7)
        doc.setTextColor(102, 102, 102)
        doc.text(`(${fmt(pattern.waste, 3)})`, x + w / 2, y + 5.2, {
          align: 'center',
        })
      }
    }
    y += barH + 3

    let acc = 0
    x = margin
    setNormal(7)
    doc.setTextColor(102, 102, 119)
    for (const p of pattern.parts) {
      const w = (p.length / total) * contentW
      acc = roundLen(acc + p.length)
      if (w > 6) doc.text(fmt(acc, 3), x + w / 2, y, { align: 'center' })
      x += w
    }
    if (pattern.waste > 0) {
      const w = (pattern.waste / total) * contentW
      if (w > 6) {
        doc.text(fmt(pattern.stockLength, 3), x + w / 2, y, { align: 'center' })
      }
    }
    y += 6
  }

  writeHeading('Схема в текстовом формате')
  writeWrapped(textScheme(result.grouped, settings), 8, 3.6)

  writeHeading('Размеры от нуля')
  writeWrapped(sizesFromZero(result.grouped, settings), 8, 3.6)

  const usefulRem = result.remainders.filter(
    (r) => r.length >= (settings.usefulRemainderMin || 0) && r.length > 0,
  )
  writeHeading('Полезные остатки')
  writeWrapped(
    usefulRem.length === 0
      ? 'Нет'
      : usefulRem
          .map((r) => `${fmt(r.length, 3)}${r.name ? ` «${r.name}»` : ''} — ${r.count} шт.`)
          .join('\n'),
  )

  writeHeading('Остатки')
  writeWrapped(
    result.remainders.length === 0
      ? 'Нет'
      : result.remainders
          .map((r) => `${fmt(r.length, 3)}${r.name ? ` «${r.name}»` : ''} — ${r.count} шт.`)
          .join('\n'),
  )

  writeHeading('Входные данные')
  setBold(10)
  ensureSpace(5)
  doc.text('Заготовки', margin, y)
  y += 5
  writeWrapped(
    stocks
      .filter((s) => typeof s.length === 'number' && s.length > 0)
      .map(
        (s) =>
          `${s.length}${s.quantity === '' ? ' — без лимита' : ` — ${s.quantity} шт.`}${
            s.name ? ` (${s.name})` : ''
          }`,
      )
      .join('\n') || '—',
  )
  setBold(10)
  ensureSpace(5)
  doc.text('Отрезки', margin, y)
  y += 5
  writeWrapped(
    parts
      .filter((p) => partCalcLength(p) > 0 && typeof p.quantity === 'number')
      .map(
        (p) =>
          `${partCalcLength(p)} — ${p.quantity} шт.${p.name ? ` (${p.name})` : ''}`,
      )
      .join('\n') || '—',
  )

  ensureSpace(10)
  y += 4
  doc.setDrawColor(213, 221, 230)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageW - margin, y)
  y += 5
  setNormal(8)
  doc.setTextColor(106, 122, 138)
  doc.text('Раскрой · локальный калькулятор оптимального раскроя', margin, y)

  doc.save(`${safeFileName(name)}.pdf`)
}
