import { authService } from './auth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

export interface Queue {
  queue_id: string
  name: string
  description: string
  created_at: string
  entries: QueueEntry[]
}

export interface QueueEntry {
  msisdn: string
  full_name: string | null
  joined_at: string
  left: boolean
  status: 'waiting' | 'in_progress' | 'served'
  started_at: string | null
  served_at: string | null
}

export interface CreateQueueData {
  name: string
  description?: string
}

class QueueServiceImpl {
  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const credentials = authService.getAuthHeaders()
    if (!credentials) {
      throw new Error('Not authenticated')
    }

    // For GET requests, add credentials as query params
    if (!options.method || options.method === 'GET') {
      const urlObj = new URL(url, API_BASE)
      urlObj.searchParams.set('username', credentials.username)
      urlObj.searchParams.set('password', credentials.password)
      url = urlObj.toString()
    } else {
      // For POST/PUT/DELETE, add credentials to body
      const body = options.body ? JSON.parse(options.body as string) : {}
      body.username = credentials.username
      body.password = credentials.password
      options.body = JSON.stringify(body)
    }

    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  }

  async getAllQueues(): Promise<Queue[]> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE}/queues/all/`)
      
      if (response.ok) {
        const data = await response.json()
        return data.queues
      }
      throw new Error('Failed to fetch queues')
    } catch (error) {
      console.error('Error fetching queues:', error)
      throw error
    }
  }

  async createQueue(queueData: CreateQueueData): Promise<Queue> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE}/queue/create/`, {
        method: 'POST',
        body: JSON.stringify(queueData),
      })

      if (response.ok) {
        const data = await response.json()
        return {
          queue_id: data.queue_id,
          name: data.name,
          description: data.description,
          created_at: data.created_at,
          entries: []
        }
      }
      throw new Error('Failed to create queue')
    } catch (error) {
      console.error('Error creating queue:', error)
      throw error
    }
  }

  async deleteQueue(queueId: string): Promise<boolean> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE}/queue/${queueId}/delete/`, {
        method: 'DELETE',
      })
      return response.ok
    } catch (error) {
      console.error('Error deleting queue:', error)
      return false
    }
  }

  async flushQueue(queueId: string): Promise<boolean> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE}/queue/${queueId}/flush/`, {
        method: 'POST',
      })
      return response.ok
    } catch (error) {
      console.error('Error flushing queue:', error)
      return false
    }
  }

  async joinQueue(queueId: string, msisdn: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/queue/join/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ queue_id: queueId, msisdn }),
      })

      if (response.ok) {
        const data = await response.json()
        return data.id
      }
      return null
    } catch (error) {
      console.error('Error joining queue:', error)
      return null
    }
  }

  async updateStatus(queueId: string, msisdn: string, status: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/queue/${queueId}/status/${msisdn}/update/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })
      return response.ok
    } catch (error) {
      console.error('Error updating status:', error)
      return false
    }
  }

  async sendAlert(): Promise<{ success: boolean; data?: { queues_processed?: number; results?: { messages_sent?: string[] }[] }; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE}/alert/`, {
        method: 'POST',
        body: JSON.stringify({}), // Credentials are added by fetchWithAuth
      })

      const data = await response.json()
      
      if (response.ok) {
        return { success: true, data }
      } else {
        return { success: false, error: data.error || 'Failed to send alerts' }
      }
    } catch (error) {
      console.error('Error sending alerts:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

export const queueService = new QueueServiceImpl()