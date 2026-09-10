import { useEffect, useState } from 'react'
import './App.css'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Analytics from './pages/Analytics'
import Alerts from './pages/Alerts'
import Assistant from './pages/Assistant'
import Settings from './pages/Settings'
import AuthGate from './components/AuthGate'

function App() {
  const [activePage, setActivePage] = useState('Dashboard')
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
  }, [darkMode])
  const [visitedPages, setVisitedPages] = useState(() => new Set(['Dashboard']))

  function handlePageChange(page) {
    setActivePage(page)
    setVisitedPages((current) => {
      if (current.has(page)) return current
      const next = new Set(current)
      next.add(page)
      return next
    })
  }

  const pages = [
    ['Dashboard', <Dashboard />],
    ['Projects', <Projects />],
    ['Analytics', <Analytics />],
    ['Alerts', <Alerts />],
    ['Assistant', <Assistant />],
    ['Settings', <Settings />],
  ]

  return (
    <AuthGate>
      <div className="app">
        <Sidebar
          activePage={activePage}
          onPageChange={handlePageChange}
          darkMode={darkMode}
          onThemeToggle={() => setDarkMode((current) => !current)}
        />
        <main className="main-content">
          {pages.map(([pageName, page]) => (
            visitedPages.has(pageName) ? (
              <div
                key={pageName}
                style={{ display: activePage === pageName ? 'block' : 'none' }}
              >
                {page}
              </div>
            ) : null
          ))}
        </main>
      </div>
    </AuthGate>
  )
}

export default App
