const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

export interface User {
  username: string
  user_id: number
}

export interface AuthService {
  login: (username: string, password: string) => Promise<boolean>
  register: (username: string, password: string) => Promise<boolean>
  getCurrentUser: () => User | null
  logout: () => void
  getAuthHeaders: () => { username: string; password: string } | null
}

class AuthServiceImpl implements AuthService {
  async login(username: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('auth_user', JSON.stringify({
          username: data.username,
          user_id: data.user_id
        }))
        localStorage.setItem('auth_credentials', JSON.stringify({
          username,
          password
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  async register(username: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/auth/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('auth_user', JSON.stringify({
          username: data.username,
          user_id: data.user_id
        }))
        localStorage.setItem('auth_credentials', JSON.stringify({
          username,
          password
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('Register error:', error)
      return false
    }
  }

  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null
    
    try {
      const userData = localStorage.getItem('auth_user')
      return userData ? JSON.parse(userData) : null
    } catch {
      return null
    }
  }

  logout(): void {
    if (typeof window === 'undefined') return
    
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_credentials')
  }

  getAuthHeaders(): { username: string; password: string } | null {
    if (typeof window === 'undefined') return null
    
    try {
      const credentials = localStorage.getItem('auth_credentials')
      return credentials ? JSON.parse(credentials) : null
    } catch {
      return null
    }
  }
}

export const authService = new AuthServiceImpl()