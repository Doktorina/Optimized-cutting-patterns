/** SVG-превью одного упакованного листа (2D). */
import type { PackedSheet } from '../algorithm/sheetPack'

const COLORS = [
  '#4dabf7',
  '#69db7c',
  '#ffd43b',
  '#ff8787',
  '#b197fc',
  '#63e6be',
  '#ffa94d',
  '#74c0fc',
]

type Props = {
  sheet: PackedSheet
  index: number
  units: string
}

export function SheetPreview({ sheet, index, units }: Props) {
  const pad = 8
  const maxW = 640
  const scale = Math.min(maxW / sheet.sheetWidth, 420 / sheet.sheetHeight)
  const w = sheet.sheetWidth * scale
  const h = sheet.sheetHeight * scale

  return (
    <div className="sheet-preview">
      <div className="sheet-preview-caption">
        Лист {index + 1}
        {sheet.sheetName ? ` — ${sheet.sheetName}` : ''} · {sheet.sheetWidth}×{sheet.sheetHeight}{' '}
        {units} · польза {sheet.usefulPercent.toFixed(2)}% · детали{' '}
        {sheet.usedArea.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} {units}²
      </div>
      <svg
        width={w + pad * 2}
        height={h + pad * 2}
        viewBox={`0 0 ${w + pad * 2} ${h + pad * 2}`}
        className="sheet-svg"
        role="img"
        aria-label={`Схема раскроя листа ${index + 1}`}
      >
        <rect
          x={pad}
          y={pad}
          width={w}
          height={h}
          className="sheet-bg"
        />
        {sheet.parts.map((p, i) => {
          const color = COLORS[i % COLORS.length]
          const rw = Math.max(1, p.width * scale)
          const rh = Math.max(1, p.height * scale)
          const x = pad + p.x * scale
          const y = pad + p.y * scale
          const title = p.name || `${p.width}×${p.height}`
          const sizeLabel = `${p.width}×${p.height}`
          const showTitle = rw > 40 && rh > 24
          const showSize = rw > 56 && rh > 38
          return (
            <g key={p.id}>
              <title>{`${title} · ${sizeLabel}${p.rotated ? ' (повёрнута)' : ''} · (${p.x}, ${p.y})`}</title>
              <rect
                x={x}
                y={y}
                width={rw}
                height={rh}
                fill={color}
                fillOpacity={0.55}
                stroke="#1c2430"
                strokeOpacity={0.45}
                strokeWidth={1}
              />
              {showTitle && (
                <text
                  x={x + rw / 2}
                  y={showSize ? y + rh / 2 - 7 : y + rh / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="sheet-label"
                >
                  {title}
                  {p.rotated ? ' ↻' : ''}
                </text>
              )}
              {showSize && (
                <text
                  x={x + rw / 2}
                  y={y + rh / 2 + 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="sheet-label sheet-label-size"
                >
                  {sizeLabel}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
