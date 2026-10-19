/** Визуальная схема 1D + текст «размеры от нуля» / текстовая схема. */
import type { GroupedPattern, Settings } from '../types'
import { roundLen } from '../types'

type Props = {
  grouped: GroupedPattern[]
  settings: Settings
}

function formatLen(n: number): string {
  const r = roundLen(n)
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/\.?0+$/, '')
}

function mergeLabels(parts: { length: number; name: string }[], merge: boolean) {
  if (!merge) {
    return parts.map((p) => {
      const length = roundLen(p.length)
      return {
        length,
        count: 1,
        label: p.name ? `${formatLen(length)} ${p.name}` : formatLen(length),
        width: length,
      }
    })
  }

  const out: { length: number; count: number; label: string; width: number }[] = []
  for (const p of parts) {
    const length = roundLen(p.length)
    const last = out[out.length - 1]
    const keyLabel = p.name ? `${formatLen(length)} ${p.name}` : formatLen(length)
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

export function CuttingMap({ grouped, settings }: Props) {
  return (
    <div>
      {grouped.map((g, gi) => {
        const { pattern, count, startIndex, endIndex } = g
        const segments = mergeLabels(pattern.parts, settings.mergeIdenticalParts)
        const capacity = pattern.stockLength
        const usedVisual = segments.reduce((s, x) => s + x.width, 0) + pattern.waste
        const scale = capacity > 0 ? 100 / Math.max(capacity, usedVisual) : 0

        let running = 0
        const markers: number[] = [0]
        for (const seg of segments) {
          running += seg.width
          markers.push(running)
        }
        if (pattern.waste > 0) markers.push(capacity)

        const title = settings.numberLayout
          ? count > 1
            ? `№ ${gi + 1}, # ${startIndex}-${endIndex}. Отрезки: ${pattern.parts.length} шт.`
            : `№ ${gi + 1}, # ${startIndex}. Отрезки: ${pattern.parts.length} шт.`
          : `Отрезки: ${pattern.parts.length} шт.`

        return (
          <table className="map-item" key={gi}>
            <caption>{title}</caption>
            <tbody>
              <tr>
                <td className="stock-label">
                  {formatLen(pattern.stockLength)} × {count}
                </td>
                {segments.map((seg, i) => (
                  <td key={i} style={{ width: `${seg.width * scale}%` }}>
                    {seg.label}
                  </td>
                ))}
                {pattern.waste > 0 && (
                  <td className="waste" style={{ width: `${pattern.waste * scale}%` }}>
                    ({formatLen(pattern.waste)})
                  </td>
                )}
              </tr>
              <tr className="markers">
                <td />
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
                      <td key="w" style={{ width: `${pattern.waste * scale}%` }}>
                        {formatLen(pattern.stockLength)}
                      </td>,
                    )
                  }
                  return cells
                })()}
              </tr>
            </tbody>
          </table>
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
          ? `№ ${gi + 1}, # ${startIndex}-${endIndex}. Отрезки: ${pattern.parts.length} шт.`
          : `№ ${gi + 1}, # ${startIndex}. Отрезки: ${pattern.parts.length} шт.`
        : `Отрезки: ${pattern.parts.length} шт.`
      const used = usedFromParts(pattern.parts)
      const waste =
        pattern.waste > 0
          ? ` = ${formatLen(used)} (остаток ${formatLen(pattern.waste)})`
          : ` = ${formatLen(pattern.stockLength)}`
      return `${head}\n${formatLen(pattern.stockLength)} x ${count} [ ${body} ]${waste}`
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
          ? `№ ${gi + 1}, # ${startIndex}-${endIndex}. Отрезки: ${pattern.parts.length} шт.`
          : `№ ${gi + 1}, # ${startIndex}. Отрезки: ${pattern.parts.length} шт.`
        : `Отрезки: ${pattern.parts.length} шт.`
      return `${head}\n${formatLen(pattern.stockLength)} x ${count} ( ${marks.map(formatLen).join(' | ')} )`
    })
    .join('\n')
}
