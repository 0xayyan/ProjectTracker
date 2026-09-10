import { useEffect, useState } from 'react'
import { changePassword, createUser, listUsers, logoutUser } from '../services/api'
import ConfirmDialog from '../components/ConfirmDialog'

function Settings() {
  const [cleared, setCleared] = useState(false)
  const username = localStorage.getItem('username') || 'User'
  const role = localStorage.getItem('role') || 'officer'
  const authenticated = Boolean(localStorage.getItem('access_token'))

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  const [users, setUsers] = useState([])
  const [newUsername, setNewUsername] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState('officer')
  const [userError, setUserError] = useState('')
  const [userSuccess, setUserSuccess] = useState('')
  const [userSaving, setUserSaving] = useState(false)

  useEffect(() => {
    if (role !== 'admin') return
    listUsers()
      .then(setUsers)
      .catch((error) => console.error(error))
  }, [role])

  function handleClearCache() {
    sessionStorage.clear()
    setCleared(true)
    setTimeout(() => setCleared(false), 2000)
  }

  function handleLogout() {
    logoutUser()
    window.location.reload()
  }

  async function handleChangePassword(event) {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setPasswordSaving(true)
    try {
      await changePassword(oldPassword, newPassword)
      setPasswordSuccess('Password updated successfully.')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(error.message)
    } finally {
      setPasswordSaving(false)
    }
  }

  async function handleCreateUser(event) {
    event.preventDefault()
    setUserError('')
    setUserSuccess('')
    setUserSaving(true)

    try {
      const created = await createUser(newUsername, newUserPassword, newUserRole)
      setUsers((current) => [...current, { id: created.id, username: created.username, role: created.role }])
      setUserSuccess(`User "${created.username}" created successfully.`)
      setNewUsername('')
      setNewUserPassword('')
      setNewUserRole('officer')
    } catch (error) {
      setUserError(error.message)
    } finally {
      setUserSaving(false)
    }
  }

  return (
    <div>
      <h1>Settings</h1>
      <p className="page-subtitle">Account, session and application information.</p>

      <div className="settings-grid">
        <section className="settings-panel">
          <h2>User Profile</h2>
          <div className="profile-row">
            <div className="profile-avatar">{username.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{username}</strong>
              <span>{role}</span>
            </div>
          </div>
        </section>

        <section className="settings-panel">
          <h2>Session</h2>
          <div className="settings-item"><span>Status</span><strong>{authenticated ? 'Authenticated' : 'Signed out'}</strong></div>
          <div className="settings-item"><span>Role</span><strong>{role}</strong></div>
          <div className="settings-item"><span>Token</span><strong>{authenticated ? 'Active' : 'Not available'}</strong></div>
        </section>

        <section className="settings-panel settings-panel-wide">
          <h2>Change Password</h2>
          <p className="section-muted">Enter your current password to set a new one.</p>
          <form className="settings-form" onSubmit={handleChangePassword}>
            <label>
              Current Password
              <input
                type="password"
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                required
              />
            </label>
            <label>
              New Password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <label>
              Confirm New Password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            {passwordError && <p className="error-message">{passwordError}</p>}
            {passwordSuccess && <p className="settings-success">{passwordSuccess}</p>}
            <button type="submit" className="settings-btn" disabled={passwordSaving}>
              {passwordSaving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </section>

        {role === 'admin' && (
          <section className="settings-panel settings-panel-wide">
            <h2>User Management</h2>
            <p className="section-muted">Add a new admin or officer account.</p>

            <form className="settings-form" onSubmit={handleCreateUser}>
              <label>
                Username
                <input
                  type="text"
                  value={newUsername}
                  onChange={(event) => setNewUsername(event.target.value)}
                  minLength={3}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(event) => setNewUserPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </label>
              <label>
                Role
                <select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value)}>
                  <option value="officer">Officer</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {userError && <p className="error-message">{userError}</p>}
              {userSuccess && <p className="settings-success">{userSuccess}</p>}
              <button type="submit" className="settings-btn" disabled={userSaving}>
                {userSaving ? 'Creating...' : 'Create User'}
              </button>
            </form>

            {users.length > 0 && (
              <ul className="user-list">
                {users.map((user) => (
                  <li key={user.id}>
                    <span>{user.username}</span>
                    <span className={`role-badge role-badge-${user.role}`}>{user.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="settings-panel settings-panel-wide">
          <h2>About ProjectWatch</h2>
          <p>Web-based integrated project monitoring platform for SIH 2026 Problem Statement 26103, combining project monitoring, rule-based risk analysis, PAIMANA-derived predictive analytics and early-warning decision support.</p>
          <div className="about-grid">
            <div><span>Version</span><strong>1.0.0</strong></div>
            <div><span>Problem Statement</span><strong>SIH 26103</strong></div>
            <div><span>Organization</span><strong>MoSPI</strong></div>
            <div><span>AI Model</span><strong>Random Forest</strong></div>
          </div>
        </section>

        <section className="settings-panel settings-panel-wide">
          <h2>Quick Actions</h2>
          <div className="settings-actions">
            <button className="settings-btn secondary" onClick={handleClearCache}>Clear Session Cache</button>
            <button className="settings-btn danger" onClick={() => setShowLogoutConfirm(true)}>Log Out</button>
          </div>
          {cleared && <p className="settings-success">Session cache cleared.</p>}
        </section>
      </div>

      <ConfirmDialog
        open={showLogoutConfirm}
        title="Log out?"
        message="You'll need to sign in again to access your account."
        confirmLabel="Log Out"
        danger
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  )
}

export default Settings;