'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { queueService, Queue, QueueEntry } from '@/lib/queue-service'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Clock, CheckCircle, Monitor, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

const REFRESH_INTERVAL = 15000 // 15 seconds

function PublicDisplayPageContent() {
  const searchParams = useSearchParams()
  const queueId = searchParams.get('queue')
  
  const [queue, setQueue] = useState<Queue | null>(null)
  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const loadQueueData = useCallback(async () => {
    if (!queueId) return
    
    try {
      setConnected(true)
      const queues = await queueService.getAllQueues()
      const currentQueue = queues.find(q => q.queue_id === queueId)
      
      if (currentQueue) {
        setQueue(currentQueue)
        const activeEntries = (currentQueue.entries || []).filter(e => !e.left)
        setEntries(activeEntries)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Failed to load queue:', error)
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [queueId])

  const loadAllQueues = useCallback(async () => {
    try {
      setConnected(true)
      const queues = await queueService.getAllQueues()
      
      // For all queues display, we'll show a summary
      const allActiveEntries: QueueEntry[] = []
      queues.forEach(q => {
        const queueEntries = (q.entries || []).filter(e => !e.left).map(e => ({
          ...e,
          queueName: q.name,
          queueId: q.queue_id
        }))
        allActiveEntries.push(...queueEntries)
      })
      
      setEntries(allActiveEntries)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to load queues:', error)
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (queueId) {
      loadQueueData()
      const interval = setInterval(loadQueueData, REFRESH_INTERVAL)
      return () => clearInterval(interval)
    } else {
      loadAllQueues()
      const interval = setInterval(loadAllQueues, REFRESH_INTERVAL)
      return () => clearInterval(interval)
    }
  }, [queueId, loadQueueData, loadAllQueues])

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'waiting':
        return { 
          label: 'WAITING', 
          icon: Clock, 
          color: 'bg-orange-500/20 text-orange-400 border-2 border-orange-400',
          bgColor: 'bg-orange-500/5'
        }
      case 'in_progress':
        return { 
          label: 'IN PROGRESS', 
          icon: Users, 
          color: 'bg-blue-500/20 text-blue-400 border-2 border-blue-400',
          bgColor: 'bg-blue-500/5'
        }
      case 'served':
        return { 
          label: 'COMPLETED', 
          icon: CheckCircle, 
          color: 'bg-green-500/20 text-green-400 border-2 border-green-400',
          bgColor: 'bg-green-500/5'
        }
      default:
        return { 
          label: 'WAITING', 
          icon: Clock, 
          color: 'bg-gray-500/20 text-gray-400 border-2 border-gray-400',
          bgColor: 'bg-gray-500/5'
        }
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPositionInQueue = (entry: QueueEntry) => {
    if (entry.status !== 'waiting') return null
    const waitingEntries = entries.filter(e => e.status === 'waiting').sort((a, b) => 
      new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    )
    return waitingEntries.findIndex(e => e.msisdn === entry.msisdn) + 1
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Monitor className="h-16 w-16 mx-auto mb-4 animate-pulse" />
          <div className="text-2xl font-bold">Loading Queue Display...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Monitor className="h-12 w-12 text-blue-400" />
            <div>
              <h1 className="text-4xl font-bold">
                {queueId && queue ? queue.name : 'All Queues Display'}
              </h1>
              <p className="text-xl text-gray-400 mt-1">
                {queueId && queue?.description ? queue.description : 'Live Queue Status Monitor'}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center space-x-2 mb-2">
              {connected ? (
                <Wifi className="h-6 w-6 text-green-400" />
              ) : (
                <WifiOff className="h-6 w-6 text-red-400" />
              )}
              <span className={`text-lg font-bold ${connected ? 'text-green-400' : 'text-red-400'}`}>
                {connected ? 'CONNECTED' : 'CONNECTION LOST'}
              </span>
            </div>
            <div className="text-gray-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Queue Stats */}
        <div className="grid grid-cols-3 gap-6 mt-6">
          <Card className="bg-gray-900 border-2 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-orange-400 flex items-center text-lg">
                <Clock className="mr-2 h-5 w-5" />
                WAITING
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-orange-400">
                {entries.filter(e => e.status === 'waiting').length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-2 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-blue-400 flex items-center text-lg">
                <Users className="mr-2 h-5 w-5" />
                IN PROGRESS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-400">
                {entries.filter(e => e.status === 'in_progress').length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-2 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-green-400 flex items-center text-lg">
                <CheckCircle className="mr-2 h-5 w-5" />
                COMPLETED
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-400">
                {entries.filter(e => e.status === 'served').length}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Queue Entries */}
      {entries.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">Current Queue Status</h2>
          
          <div className="grid gap-4">
            {entries
              .sort((a, b) => {
                // Sort by status priority, then by join time
                const statusPriority = { 'in_progress': 0, 'waiting': 1, 'served': 2 }
                const aPriority = statusPriority[a.status as keyof typeof statusPriority] || 3
                const bPriority = statusPriority[b.status as keyof typeof statusPriority] || 3
                
                if (aPriority !== bPriority) {
                  return aPriority - bPriority
                }
                
                return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
              })
              .map((entry, index) => {
                const statusInfo = getStatusInfo(entry.status)
                const position = getPositionInQueue(entry)
                const Icon = statusInfo.icon

                return (
                  <Card key={entry.msisdn} className={cn("border-2 transition-all", statusInfo.bgColor, statusInfo.color.split(' ').slice(-2).join(' '))}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gray-800 border-2 border-gray-600 flex items-center justify-center text-xl font-bold">
                            {index + 1}
                          </div>
                          
                          <div>
                            <div className="text-2xl font-bold font-mono">
                              {entry.msisdn}
                            </div>
                            {!queueId && (entry as QueueEntry & { queueName?: string }).queueName && (
                              <div className="text-lg text-gray-400">
                                Queue: {(entry as QueueEntry & { queueName?: string }).queueName}
                              </div>
                            )}
                            <div className="text-lg text-gray-400">
                              Joined: {formatTime(entry.joined_at)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="flex items-center space-x-3 mb-2">
                            <Icon className="h-6 w-6" />
                            <Badge variant="outline" className={cn("text-lg font-bold px-4 py-2", statusInfo.color)}>
                              {statusInfo.label}
                            </Badge>
                          </div>
                          
                          {position && (
                            <div className="text-lg font-bold text-orange-400">
                              Position: #{position}
                            </div>
                          )}
                          
                          {entry.status === 'in_progress' && entry.started_at && (
                            <div className="text-lg text-blue-400">
                              Started: {formatTime(entry.started_at)}
                            </div>
                          )}
                          
                          {entry.status === 'served' && entry.served_at && (
                            <div className="text-lg text-green-400">
                              Completed: {formatTime(entry.served_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-32 h-32 bg-gray-800 border-2 border-gray-600 flex items-center justify-center mb-6">
            <Users className="h-16 w-16 text-gray-500" />
          </div>
          <h3 className="text-3xl font-bold text-gray-400 mb-4">No Active Queue Entries</h3>
          <p className="text-xl text-gray-500 text-center max-w-md">
            {queueId ? 'This queue is currently empty.' : 'All queues are currently empty.'}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="fixed bottom-4 right-4 text-gray-500">
        <div className="text-sm">
          Auto-refresh every {REFRESH_INTERVAL / 1000} seconds
        </div>
      </div>
    </div>
  )
}

export default function PublicDisplayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Monitor className="h-16 w-16 mx-auto mb-4 animate-pulse" />
          <div className="text-2xl font-bold">Loading Display...</div>
        </div>
      </div>
    }>
      <PublicDisplayPageContent />
    </Suspense>
  )
}