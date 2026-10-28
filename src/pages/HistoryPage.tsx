/** Сохранённые расчёты (localStorage). Загрузка возвращает на /stocks. */
import { useApp } from '../context/AppContext'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU')
  } catch {
    return iso
  }
}

export function HistoryPage() {
  const {
    history,
    saveHistory,
    loadHistoryEntry,
    deleteHistoryEntry,
    clearAllHistory,
    refreshHistory,
  } = useApp()

  return (
    <div className="page-card">
      <header className="page-head">
        <h1>История</h1>
        <p>Сохраняется локально на этом устройстве. Можно сохранить текущий расчёт и загрузить позже.</p>
      </header>

      <div className="import-actions">
        <button type="button" className="btn btn-blue" onClick={saveHistory}>
          + Сохранить текущий
        </button>
        <button type="button" className="btn btn-blue" onClick={refreshHistory}>
          Обновить
        </button>
        <button type="button" className="btn btn-ghost" onClick={clearAllHistory}>
          Очистить историю
        </button>
      </div>

      {history.length === 0 ? (
        <p className="hint empty-state">Пока нет сохранённых раскроев.</p>
      ) : (
        <div className="history-table-wrap">
          <table className="data-table history-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Название</th>
                <th>Заготовок</th>
                <th>Отрезков</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {history.map((e) => {
                const stockCount = e.result?.stocksUsed.reduce((s, x) => s + x.count, 0) ?? '—'
                const partsCount = e.parts
                  .filter((p) => typeof p.quantity === 'number')
                  .reduce((s, p) => s + (p.quantity as number), 0)
                return (
                  <tr key={e.id}>
                    <td>{formatDate(e.createdAt)}</td>
                    <td>{e.title || 'Без названия'}</td>
                    <td>{stockCount}</td>
                    <td>{partsCount || '—'}</td>
                    <td className="history-actions">
                      <button type="button" className="btn btn-blue" onClick={() => loadHistoryEntry(e)}>
                        Загрузить
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => deleteHistoryEntry(e.id)}
                        aria-label="Удалить"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
