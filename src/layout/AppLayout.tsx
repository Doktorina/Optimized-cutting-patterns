/** Оболочка: боковое меню + область страницы (Outlet). */
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  return (
    <div className="shell">
      <Sidebar />
      <div className="shell-main">
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
