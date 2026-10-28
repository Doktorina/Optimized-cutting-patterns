/** Поле числа с запятой — можно спокойно вводить «3,3» / «7,904». */
import { useEffect, useRef, useState } from 'react'
import { asMeterLength, roundLen } from '../types'

type Props = {
  value: number | ''
  onChange: (value: number | '') => void
  placeholder?: string
  inputMode?: 'decimal' | 'numeric'
  /** Длина в метрах: 3115 → 3,115 */
  meterLength?: boolean
  'aria-label'?: string
}

function parseRaw(raw: string, meterLength: boolean): number | '' {
  const trimmed = raw.trim().replace(/\s/g, '')
  if (trimmed === '' || trimmed === '.' || trimmed === ',' || trimmed === '-' || trimmed === '-.' || trimmed === '-,') {
    return ''
  }
  const hasSep = /[.,]/.test(trimmed)
  const cleaned = trimmed.replace(',', '.')
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return ''
  if (meterLength && !hasSep && Number.isInteger(n) && Math.abs(n) >= 1000) {
    return asMeterLength(n)
  }
  return meterLength ? asMeterLength(n) : roundLen(n)
}

function formatNum(value: number | '', meterLength: boolean): string {
  if (value === '') return ''
  const rounded = meterLength ? asMeterLength(value) : roundLen(value)
  // Отрезки в метрах — всегда три знака: 0,320
  if (meterLength) return rounded.toFixed(3).replace('.', ',')
  const s = rounded.toFixed(3).replace(/\.?0+$/, '')
  return s.replace('.', ',')
}

export function DecimalInput({
  value,
  onChange,
  placeholder = '',
  inputMode = 'decimal',
  meterLength = false,
  'aria-label': ariaLabel,
}: Props) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState(() => formatNum(value, meterLength))
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!focused) setText(formatNum(value, meterLength))
  }, [value, focused, meterLength])

  // Уже лежащие в таблице «3115» → «3,115» (без лишних сбросов при ререндере)
  useEffect(() => {
    if (!meterLength || value === '' || focused) return
    const fixed = asMeterLength(value)
    if (fixed !== value) onChangeRef.current(fixed)
  }, [value, meterLength, focused])

  return (
    <input
      type="text"
      inputMode={inputMode}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={focused ? text : formatNum(value, meterLength)}
      onFocus={() => {
        setFocused(true)
        setText(formatNum(value, meterLength))
      }}
      onBlur={() => {
        const parsed = parseRaw(text, meterLength)
        onChange(parsed)
        setText(formatNum(parsed, meterLength))
        setFocused(false)
      }}
      onChange={(e) => {
        const raw = e.target.value
        if (raw !== '' && !/^-?\d*[.,]?\d*$/.test(raw)) return
        setText(raw)
        if (raw.trim() === '') {
          onChange('')
          return
        }
        if (/[.,]$/.test(raw.trim())) return
        const parsed = parseRaw(raw, meterLength)
        if (parsed !== '') onChange(parsed)
      }}
    />
  )
}
