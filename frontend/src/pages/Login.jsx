import { useState } from 'react'
import { loginUser } from '../services/api'

function Login({ onBack, darkMode, onThemeToggle }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await loginUser(username, password)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('username', data.username)
      localStorage.setItem('role', data.role)
      window.location.reload()
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-top-actions">
        <button type="button" className="theme-toggle-btn" onClick={onThemeToggle}>
          {darkMode ? '☀ Light' : '☾ Dark'}
        </button>
        {onBack && (
          <button type="button" className="public-login-btn" onClick={onBack}>
            Back to Public View
          </button>
        )}
      </div>

      <div className="login-card">
        <h1>Project Monitoring</h1>
        <p>Sign in to continue</p>

        {error && <p className="error-message">{error}</p>}

        <form onSubmit={handleLogin}>
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
