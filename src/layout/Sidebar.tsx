/** Боковое меню и кнопки: Раскрой / Пример / Очистить (линейный режим). */
import { NavLink } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const links = [
  { to: '/stocks', label: 'Линия раскройки', icon: 'stock' },
  { to: '/sheet', label: 'Раскройка листа', icon: 'sheet' },
  { to: '/settings', label: 'Настройка', icon: 'settings' },
  { to: '/history', label: 'История', icon: 'history' },
] as const

function Icon({ name }: { name: (typeof links)[number]['icon'] }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'history':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v5l3 2" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )
    case 'stock':
      return (
        <svg {...common}>
          <rect x="4" y="7" width="16" height="10" rx="1.5" />
          <path d="M8 7V5M16 7V5M4 12h16" />
        </svg>
      )
    case 'sheet':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M4 12h16M12 4v16M4 8h8M12 16h8" />
        </svg>
      )
  }
}

export function Sidebar() {
  const { calculate, clearAll, loadDemo, calculating, result } = useApp()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo" aria-hidden />
        <div>
          <div className="sidebar-title">Раскрой</div>
          <div className="sidebar-sub">калькулятор</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
          >
            <span className="side-icon">
              <Icon name={link.icon} />
            </span>
            <span>{link.label}</span>
            {link.to === '/stocks' && result ? <span className="side-dot" /> : null}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-actions">
        <button type="button" className="btn btn-green side-action" onClick={calculate} disabled={calculating}>
          {calculating ? 'Расчёт…' : 'Раскрой'}
        </button>
        <button type="button" className="btn btn-side-secondary side-action" onClick={loadDemo}>
          Пример данных
        </button>
        <button type="button" className="btn btn-red side-action" onClick={clearAll}>
          Очистить всё
        </button>
      </div>
    </aside>
  )
}
