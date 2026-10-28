/** Настройки линейного раскроя: пропил, торцовка, порядок блоков результата. */
import { useApp } from '../context/AppContext'
import type { ResultBlockId, Settings } from '../types'
import { RESULT_BLOCK_META } from '../types'

export function SettingsPage() {
  const { settings, setSettings } = useApp()
  const patch = (partial: Partial<Settings>) => setSettings({ ...settings, ...partial })

  const moveBlock = (id: ResultBlockId, dir: -1 | 1) => {
    const order = [...settings.resultOrder]
    const idx = order.indexOf(id)
    if (idx < 0) return
    const meta = RESULT_BLOCK_META.find((m) => m.id === id)
    if (!meta?.reorderable) return
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= order.length) return
    const swapMeta = RESULT_BLOCK_META.find((m) => m.id === order[swapIdx])
    if (!swapMeta?.reorderable) return
    ;[order[idx], order[swapIdx]] = [order[swapIdx], order[idx]]
    patch({ resultOrder: order })
  }

  const toggleVisible = (id: ResultBlockId) => {
    patch({
      resultVisible: {
        ...settings.resultVisible,
        [id]: !settings.resultVisible[id],
      },
    })
  }

  return (
    <div className="page-card">
      <header className="page-head">
        <h1>Настройка</h1>
        <p>Параметры расчёта и отображение блоков результата.</p>
      </header>

      <div className="settings-grid">
        <div className="field">
          <label htmlFor="kerf">Толщина лезвия (пропил)</label>
          <input
            id="kerf"
            type="number"
            min={0}
            step="any"
            value={settings.bladeKerf}
            onChange={(e) => patch({ bladeKerf: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="field">
          <label htmlFor="trim">Торцовка</label>
          <input
            id="trim"
            type="number"
            min={0}
            step="any"
            value={settings.trimming}
            onChange={(e) => patch({ trimming: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="field">
          <label htmlFor="usefulMin">Мин. длина полезного остатка</label>
          <input
            id="usefulMin"
            type="number"
            min={0}
            step="any"
            value={settings.usefulRemainderMin}
            onChange={(e) => patch({ usefulRemainderMin: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="field">
          <label htmlFor="units">Единицы измерения</label>
          <input
            id="units"
            type="text"
            value={settings.units}
            onChange={(e) => patch({ units: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="sortStocks">Сортировать заготовки</label>
          <select
            id="sortStocks"
            value={settings.sortStocks}
            onChange={(e) => patch({ sortStocks: e.target.value as Settings['sortStocks'] })}
          >
            <option value="none">По очерёдности (1→2, 0 в конце)</option>
            <option value="priority">По очерёдности (1→2, 0 в конце)</option>
            <option value="asc">По возрастанию длины</option>
            <option value="desc">По убыванию длины</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sortParts">Сортировать отрезки</label>
          <select
            id="sortParts"
            value={settings.sortParts}
            onChange={(e) => patch({ sortParts: e.target.value as Settings['sortParts'] })}
          >
            <option value="none">По убыванию (FFD)</option>
            <option value="desc">По убыванию длины</option>
            <option value="asc">По возрастанию длины</option>
          </select>
        </div>
        <label className="field-check">
          <input
            type="checkbox"
            checked={settings.numberLayout}
            onChange={(e) => patch({ numberLayout: e.target.checked })}
          />
          Пронумеровать схему раскроя
        </label>
        <label className="field-check">
          <input
            type="checkbox"
            checked={settings.mergeIdenticalParts}
            onChange={(e) => patch({ mergeIdenticalParts: e.target.checked })}
          />
          Объединить одинаковые отрезки на схеме
        </label>
      </div>

      <h3 className="settings-subtitle">Показывать в результатах расчётов</h3>
      <p className="hint">Переключатели включают блоки. Стрелки меняют порядок.</p>
      <ul className="result-visibility-list">
        {settings.resultOrder.map((id) => {
          const meta = RESULT_BLOCK_META.find((m) => m.id === id)
          if (!meta) return null
          return (
            <li key={id} className="result-visibility-item">
              <div className="result-visibility-left">
                {meta.reorderable ? (
                  <span className="drag-hint" aria-hidden>
                    ≡
                  </span>
                ) : (
                  <span className="drag-hint muted" aria-hidden>
                    ·
                  </span>
                )}
                <span>{meta.label}</span>
              </div>
              <div className="result-visibility-right">
                {meta.reorderable && (
                  <div className="order-btns">
                    <button type="button" className="btn btn-order" onClick={() => moveBlock(id, -1)} aria-label="Выше">
                      ↑
                    </button>
                    <button type="button" className="btn btn-order" onClick={() => moveBlock(id, 1)} aria-label="Ниже">
                      ↓
                    </button>
                  </div>
                )}
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={!!settings.resultVisible[id]}
                    onChange={() => toggleVisible(id)}
                  />
                  <span className="slider" />
                </label>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
