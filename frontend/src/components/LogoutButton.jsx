import { useState } from 'react'
import { logoutUser } from '../services/api'
import ConfirmDialog from './ConfirmDialog'

function LogoutButton() {
  const [showConfirm, setShowConfirm] = useState(false)

  function handleConfirmLogout() {
    logoutUser()
    window.location.reload()
  }

  return (
    <>
      <button className="logout-btn" onClick={() => setShowConfirm(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>Log Out</span>
      </button>

      <ConfirmDialog
        open={showConfirm}
        title="Log out?"
        message="You'll need to sign in again to access your account."
        confirmLabel="Log Out"
        danger
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  )
}

export default LogoutButton;