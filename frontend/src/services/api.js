const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

// Keep successful GET responses for the lifetime of this SPA page session.
// This prevents repeated navigation from re-fetching/re-processing the 1,911-project dataset.
// The cache is cleared on login/logout and after POST/PUT/PATCH/DELETE mutations.
const getCache = new Map()
const inFlightGetRequests = new Map()

function logoutUser() {
  localStorage.removeItem("access_token")
  localStorage.removeItem("username")
  localStorage.removeItem("role")
  clearApiCache()
}

async function parseError(response, fallback) {
  try {
    const data = await response.json()
    return data.detail || data.message || fallback
  } catch {
    return fallback
  }
}

function isGetRequest(options) {
  return !options.method || options.method.toUpperCase() === "GET"
}

function getCacheKey(endpoint) {
  // The app has one authenticated API session at a time, so the endpoint is
  // sufficient here. The cache is also cleared on logout and mutations.
  return endpoint
}

function readCachedGet(endpoint) {
  const key = getCacheKey(endpoint)
  const cached = getCache.get(key)

  if (!cached) return undefined

  return cached.data
}

function writeCachedGet(endpoint, data) {
  getCache.set(getCacheKey(endpoint), {
    data,
  })
}

function getCachedApiResponse(endpoint) {
  return readCachedGet(endpoint)
}

function clearApiCache(endpoint = null) {
  if (endpoint) {
    getCache.delete(getCacheKey(endpoint))
    return
  }

  getCache.clear()
}

function invalidateProjectData() {
  // A project or milestone mutation can affect lists, details, risk and AI
  // predictions, so invalidate all GET responses. In-flight requests are not
  // cancelled; their result can still be used by the current page.
  clearApiCache()
}

async function apiRequest(endpoint, options = {}) {
  const useGetCache = isGetRequest(options)
  const cacheKey = getCacheKey(endpoint)

  if (useGetCache) {
    const cached = readCachedGet(endpoint)
    if (cached !== undefined) {
      return cached
    }

    const existingRequest = inFlightGetRequests.get(cacheKey)
    if (existingRequest) {
      return existingRequest
    }
  }

  const token = localStorage.getItem("access_token")
  const headers = new Headers(options.headers || {})

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const requestPromise = (async () => {
    let response

    const controller = options.signal ? null : new AbortController()
    const timeoutId = controller ? setTimeout(() => controller.abort(), 60000) : null

    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        ...(controller ? { signal: controller.signal } : {}),
      })
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("The request took too long. Please make sure the backend is running and try again.")
      }
      throw new Error("Unable to connect to the backend. Make sure FastAPI is running on port 8000.")
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }

    if (response.status === 401) {
      logoutUser()
      window.location.reload()
      throw new Error("Your session has expired. Please sign in again.")
    }

    if (!response.ok) {
      throw new Error(
        await parseError(
          response,
          "Something went wrong while processing your request."
        )
      )
    }

    if (response.status === 204) {
      return null
    }

    const data = await response.json()

    if (useGetCache) {
      writeCachedGet(endpoint, data)
    } else {
      // POST/PUT/PATCH/DELETE may change project-related data.
      invalidateProjectData()
    }

    return data
  })()

  if (useGetCache) {
    inFlightGetRequests.set(cacheKey, requestPromise)
    requestPromise.finally(() => {
      if (inFlightGetRequests.get(cacheKey) === requestPromise) {
        inFlightGetRequests.delete(cacheKey)
      }
    }).catch(() => {})
  }

  return requestPromise
}

async function loginUser(username, password) {
  const body = new URLSearchParams()
  body.append("username", username)
  body.append("password", password)

  let response

  try {
    response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    })
  } catch {
    throw new Error("Unable to connect to the backend. Make sure FastAPI is running on port 8000.")
  }

  if (!response.ok) {
    throw new Error(
      await parseError(
        response,
        "Login failed."
      )
    )
  }

  const data = await response.json()
  clearApiCache()
  return data
}

function isAuthenticated() {
  return Boolean(localStorage.getItem("access_token"))
}

async function changePassword(oldPassword, newPassword) {
  return apiRequest("/users/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
    }),
  })
}

async function listUsers() {
  return apiRequest("/admin/users")
}

async function createUser(username, password, role) {
  return apiRequest("/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role }),
  })
}

export {
  apiRequest,
  loginUser,
  logoutUser,
  isAuthenticated,
  changePassword,
  listUsers,
  createUser,
  clearApiCache,
  invalidateProjectData,
  getCachedApiResponse,
}
