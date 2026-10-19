/** SVG-превью одного упакованного листа. */
import type { PackedSheet, PlacedRect } from '../algorithm/sheetPack'

const COLORS = [
  '#b7e4a8',
  '#9ec9f5',
  '#c5e0a8',
  '#ffd43b',
  '#ff8787',
  '#b197fc',
  '#63e6be',
  '#ffa94d',
]

type Props = {
  sheet: PackedSheet
  index: number
  units: string
  compact?: boolean
  selected?: boolean
  onSelect?: () => void
}

function dimLabel(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

function wasteRects(sheet: PackedSheet): { x: number; y: number; width: number; height: number }[] {
  if (!sheet.parts.length) {
    return [{ x: 0, y: 0, width: sheet.sheetWidth, height: sheet.sheetHeight }]
  }
  let maxX = 0
  let maxY = 0
  for (const p of sheet.parts) {
    maxX = Math.max(maxX, p.x + p.width)
    maxY = Math.max(maxY, p.y + p.height)
  }
  const out: { x: number; y: number; width: number; height: number }[] = []
  if (maxX < sheet.sheetWidth - 1) {
    out.push({ x: maxX, y: 0, width: sheet.sheetWidth - maxX, height: sheet.sheetHeight })
  }
  if (maxY < sheet.sheetHeight - 1) {
    out.push({ x: 0, y: maxY, width: Math.min(maxX, sheet.sheetWidth), height: sheet.sheetHeight - maxY })
  }
  return out.filter((r) => r.width > 2 && r.height > 2)
}

function PartDrawing({
  p,
  scale,
  pad,
}: {
  p: PlacedRect
  scale: number
  pad: number
}) {
  const color = COLORS[(p.typeIndex - 1) % COLORS.length]
  const rw = Math.max(1, p.width * scale)
  const rh = Math.max(1, p.height * scale)
  const x = pad + p.x * scale
  const y = pad + p.y * scale
  const showW = rw > 36
  const showH = rh > 28
  const showNum = rw > 22 && rh > 18

  return (
    <g>
      <title>{`#${p.typeIndex} ${p.name || ''} · ${dimLabel(p.width)}×${dimLabel(p.height)}${p.rotated ? ' ↻' : ''}`}</title>
      <rect
        x={x}
        y={y}
        width={rw}
        height={rh}
        fill={color}
        stroke="#2c5282"
        strokeWidth={1.2}
      />
      {showW && (
        <text
          x={x + rw / 2}
          y={y + 11}
          textAnchor="middle"
          className="sheet-dim"
        >
          {dimLabel(p.width)}
        </text>
      )}
      {showH && (
        <text
          x={x + 10}
          y={y + rh / 2}
          textAnchor="middle"
          className="sheet-dim"
          transform={`rotate(-90 ${x + 10} ${y + rh / 2})`}
        >
          {dimLabel(p.height)}
        </text>
      )}
      {showNum && (
        <text
          x={x + rw - 6}
          y={y + rh - 5}
          textAnchor="end"
          className="sheet-type-num"
        >
          #{p.typeIndex}
        </text>
      )}
    </g>
  )
}

export function SheetPreview({ sheet, index, units, compact, selected, onSelect }: Props) {
  const pad = compact ? 4 : 10
  const maxW = compact ? 140 : 720
  const maxH = compact ? 90 : 480
  const scale = Math.min(maxW / sheet.sheetWidth, maxH / sheet.sheetHeight)
  const w = sheet.sheetWidth * scale
  const h = sheet.sheetHeight * scale
  const wastes = wasteRects(sheet)

  const body = (
    <>
      {!compact && (
        <div className="sheet-preview-caption">
          {index + 1}. {sheet.sheetWidth}×{sheet.sheetHeight}
          {sheet.sheetName ? ` — ${sheet.sheetName}` : ''} · {units} · польза{' '}
          {sheet.usefulPercent.toFixed(1)}%
        </div>
      )}
      <svg
        width={w + pad * 2}
        height={h + pad * 2}
        viewBox={`0 0 ${w + pad * 2} ${h + pad * 2}`}
        className="sheet-svg"
        role="img"
        aria-label={`Схема раскроя листа ${index + 1}`}
      >
        <defs>
          <pattern id={`waste-hatch-${index}`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#e53e3e" strokeWidth="1.5" strokeOpacity="0.55" />
          </pattern>
        </defs>
        <rect x={pad} y={pad} width={w} height={h} className="sheet-bg" />
        {wastes.map((r, i) => (
          <g key={i}>
            <rect
              x={pad + r.x * scale}
              y={pad + r.y * scale}
              width={Math.max(1, r.width * scale)}
              height={Math.max(1, r.height * scale)}
              fill={`url(#waste-hatch-${index})`}
              fillOpacity={0.35}
              stroke="#c53030"
              strokeOpacity={0.35}
              strokeWidth={0.8}
            />
            {r.width * scale > 28 && r.height * scale > 16 && (
              <text
                x={pad + (r.x + r.width / 2) * scale}
                y={pad + (r.y + r.height / 2) * scale}
                textAnchor="middle"
                dominantBaseline="middle"
                className="sheet-dim sheet-dim-waste"
              >
                {dimLabel(Math.round(r.width))}
              </text>
            )}
          </g>
        ))}
        {sheet.parts.map((p) => (
          <PartDrawing key={p.id} p={p} scale={scale} pad={pad} />
        ))}
      </svg>
      {compact && (
        <div className="sheet-thumb-label">
          {index + 1}. {sheet.sheetWidth}×{sheet.sheetHeight}
        </div>
      )}
    </>
  )

  if (onSelect) {
    return (
      <button
        type="button"
        className={`sheet-preview${compact ? ' sheet-preview-thumb' : ''}${selected ? ' selected' : ''}`}
        onClick={onSelect}
      >
        {body}
      </button>
    )
  }

  return <div className={`sheet-preview${compact ? ' sheet-preview-thumb' : ''}`}>{body}</div>
}
