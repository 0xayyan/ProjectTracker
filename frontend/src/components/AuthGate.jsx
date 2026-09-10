import Login from '../pages/Login'
import { isAuthenticated } from '../services/api'

function AuthGate({ children }) {
  if (!isAuthenticated()) {
    return <Login />
  }

  return children
}

export default AuthGate;