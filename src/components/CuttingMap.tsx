/** Визуальная схема 1D + текст «размеры от нуля» / текстовая схема. */
import type { GroupedPattern, Settings } from '../types'
import { roundLen } from '../types'

type Props = {
  grouped: GroupedPattern[]
  settings: Settings
}

function formatLen(n: number): string {
  const r = roundLen(n)
  return Number.isInteger(r) ? String(r) : r.toFixed(3).replace(/\.?0+$/, '')
}

/** Подпись отрезка: длина + название отрезка (не заготовки). */
function segmentLabel(length: number, partName: string): string {
  const name = (partName || '').trim()
  const len = formatLen(length)
  return name ? `${len} ${name}` : len
}

function mergeLabels(parts: { length: number; name: string }[], merge: boolean) {
  if (!merge) {
    return parts.map((p) => {
      const length = roundLen(p.length)
      return {
        length,
        count: 1,
        label: segmentLabel(length, p.name),
        width: length,
      }
    })
  }

  const out: { length: number; count: number; label: string; width: number }[] = []
  for (const p of parts) {
    const length = roundLen(p.length)
    const last = out[out.length - 1]
    const keyLabel = segmentLabel(length, p.name)
    if (last && last.length === length && last.label.replace(/ \(x\d+\)$/, '') === keyLabel) {
      last.count += 1
      last.width = roundLen(last.width + length)
      last.label = `${keyLabel} (x${last.count})`
    } else {
      out.push({ length, count: 1, label: keyLabel, width: length })
    }
  }
  return out
}

/** В узкой ячейке — только длина; полное название в title. */
function cellText(fullLabel: string, pct: number, lengthOnly: string): string {
  return pct < 18 ? lengthOnly : fullLabel
}

export function CuttingMap({ grouped, settings }: Props) {
  return (
    <div>
      {grouped.map((g, gi) => {
        const { pattern, count, startIndex, endIndex } = g
        const stockName = (pattern.stockName || '').trim()
        const segments = mergeLabels(pattern.parts, settings.mergeIdenticalParts)
        const capacity = pattern.stockLength
        const usedVisual = segments.reduce((s, x) => s + x.width, 0) + pattern.waste
        const scale = capacity > 0 ? 100 / Math.max(capacity, usedVisual) : 0
        const wastePct = pattern.waste > 0 ? pattern.waste * scale : 0

        const title = settings.numberLayout
          ? count > 1
            ? `№ ${gi + 1}, # ${startIndex}–${endIndex}`
            : `№ ${gi + 1}, # ${startIndex}`
          : `Схема ${gi + 1}`

        return (
          <div className="map-block" key={gi}>
            <div className="map-block-head">
              <span className="map-block-title">{title}</span>
              <span className="map-block-meta">
                Заготовок: {count} шт. × {formatLen(pattern.stockLength)}
                {stockName ? ` «${stockName}»` : ''}
                {' · '}
                на каждой отрезков: {pattern.parts.length} шт.
                {pattern.waste > 0 && wastePct < 18
                  ? ` · остаток ${formatLen(pattern.waste)}`
                  : ''}
              </span>
            </div>
            <table className="map-item">
              <tbody>
                <tr>
                  {segments.map((seg, i) => {
                    const pct = seg.width * scale
                    const short = formatLen(seg.length)
                    return (
                      <td
                        key={i}
                        className={pct < 12 ? 'map-cell-tight' : undefined}
                        style={{ width: `${pct}%` }}
                        title={seg.label}
                      >
                        {cellText(seg.label, pct, short)}
                      </td>
                    )
                  })}
                  {pattern.waste > 0 && (
                    <td
                      className={`waste${wastePct < 12 ? ' map-cell-tight' : ''}`}
                      style={{ width: `${Math.max(wastePct, 1.2)}%` }}
                      title={formatLen(pattern.waste)}
                    >
                      ({formatLen(pattern.waste)})
                    </td>
                  )}
                </tr>
                <tr className="markers">
                  {(() => {
                    let acc = 0
                    const cells = segments.map((seg, i) => {
                      acc += seg.width
                      return (
                        <td key={i} style={{ width: `${seg.width * scale}%` }}>
                          {formatLen(acc)}
                        </td>
                      )
                    })
                    if (pattern.waste > 0) {
                      cells.push(
                        <td key="w" style={{ width: `${Math.max(wastePct, 1.2)}%` }}>
                          {formatLen(pattern.stockLength)}
                        </td>,
                      )
                    }
                    return cells
                  })()}
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

function usedFromParts(parts: { length: number }[]): number {
  return roundLen(parts.reduce((s, p) => s + roundLen(p.length), 0))
}

export function textScheme(grouped: GroupedPattern[], settings: Settings): string {
  return grouped
    .map((g, gi) => {
      const { pattern, count, startIndex, endIndex } = g
      const segs = mergeLabels(pattern.parts, settings.mergeIdenticalParts)
      const body = segs.map((s) => s.label).join(' ][ ')
      const head = settings.numberLayout
        ? count > 1
          ? `№ ${gi + 1}, # ${startIndex}–${endIndex}`
          : `№ ${gi + 1}, # ${startIndex}`
        : `Схема ${gi + 1}`
      const used = usedFromParts(pattern.parts)
      const waste =
        pattern.waste > 0
          ? ` = ${formatLen(used)} (остаток ${formatLen(pattern.waste)})`
          : ` = ${formatLen(pattern.stockLength)}`
      const stockLabel = pattern.stockName ? ` «${pattern.stockName}»` : ''
      return `${head}\nЗаготовок ${count} шт. × ${formatLen(pattern.stockLength)}${stockLabel} [ ${body} ]${waste}`
    })
    .join('\n')
}

export function sizesFromZero(grouped: GroupedPattern[], settings: Settings): string {
  return grouped
    .map((g, gi) => {
      const { pattern, count, startIndex, endIndex } = g
      let acc = 0
      const marks = [0]
      for (const p of pattern.parts) {
        acc = roundLen(acc + roundLen(p.length))
        marks.push(acc)
      }
      const head = settings.numberLayout
        ? count > 1
          ? `№ ${gi + 1}, # ${startIndex}–${endIndex}`
          : `№ ${gi + 1}, # ${startIndex}`
        : `Схема ${gi + 1}`
      return `${head}\nЗаготовок ${count} шт. × ${formatLen(pattern.stockLength)} ( ${marks.map(formatLen).join(' | ')} )`
    })
    .join('\n')
}
