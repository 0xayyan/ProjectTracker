import { useEffect, useState } from 'react'
import './App.css'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Analytics from './pages/Analytics'
import Alerts from './pages/Alerts'
import Assistant from './pages/Assistant'
import Settings from './pages/Settings'
import Login from './pages/Login'
import PublicHome from './pages/PublicHome'
import { isAuthenticated } from './services/api'

function App() {
  const authenticated = isAuthenticated()
  const [showLogin, setShowLogin] = useState(authenticated)
  const [activePage, setActivePage] = useState('Dashboard')
  const [darkMode, setDarkMode] = useState(false)
  const [visitedPages, setVisitedPages] = useState(() => new Set(['Dashboard']))

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  useEffect(() => {
    if (authenticated) {
      setShowLogin(false)
    }
  }, [authenticated])

  function handlePageChange(page) {
    setActivePage(page)
    setVisitedPages((current) => {
      if (current.has(page)) return current
      const next = new Set(current)
      next.add(page)
      return next
    })
  }

  if (!authenticated) {
    if (showLogin) {
      return (
        <Login
          onBack={() => setShowLogin(false)}
          darkMode={darkMode}
          onThemeToggle={() => setDarkMode((current) => !current)}
        />
      )
    }

    return (
      <PublicHome
        darkMode={darkMode}
        onThemeToggle={() => setDarkMode((current) => !current)}
        onLogin={() => setShowLogin(true)}
      />
    )
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
    <div className="app">
      <Sidebar
        activePage={activePage}
        onPageChange={handlePageChange}
        darkMode={darkMode}
        onThemeToggle={() => setDarkMode((current) => !current)}
      />
      <main className="main-content">
        {pages.map(([pageName, page]) =>
          visitedPages.has(pageName) ? (
            <div
              key={pageName}
              style={{ display: activePage === pageName ? 'block' : 'none' }}
            >
              {page}
            </div>
          ) : null
        )}
      </main>
    </div>
  )
}

export default App
