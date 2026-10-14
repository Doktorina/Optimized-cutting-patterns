/**
 * Маршруты приложения «Раскрой».
 *
 * /stocks  — линия (заготовки + отрезки + импорт + результат)
 * /sheet   — раскрой листа (2D)
 * /settings, /history
 * Старые /import /parts /result → якоря на /stocks
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AppLayout } from './layout/AppLayout'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { SheetPage } from './pages/SheetPage'
import { StocksPage } from './pages/StocksPage'
import './styles/app.css'

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/stocks" replace />} />
            <Route path="stocks" element={<StocksPage />} />
            <Route path="sheet" element={<SheetPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="import" element={<Navigate to="/stocks#import" replace />} />
            <Route path="parts" element={<Navigate to="/stocks#parts" replace />} />
            <Route path="result" element={<Navigate to="/stocks#result" replace />} />
            <Route path="*" element={<Navigate to="/stocks" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}
