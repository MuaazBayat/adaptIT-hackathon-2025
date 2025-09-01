'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Settings, ArrowLeft, Users, Clock, CheckCircle } from 'lucide-react'
import { authService } from '@/lib/auth'
import { queueService, Queue, QueueEntry } from '@/lib/queue-service'
import { DroppableColumn } from '@/components/queue/droppable-column'
import { QueueEntryCard } from '@/components/queue/queue-entry-card'

const COLUMNS = {
  waiting: { title: 'WAITING', status: 'waiting' as const, icon: Clock },
  in_progress: { title: 'IN PROGRESS', status: 'in_progress' as const, icon: Users },
  served: { title: 'SERVED', status: 'served' as const, icon: CheckCircle },
}

export default function QueueManagementPage() {
  const params = useParams()
  const router = useRouter()
  const queueId = params.id as string

  const [queue, setQueue] = useState<Queue | null>(null)
  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeEntry, setActiveEntry] = useState<QueueEntry | null>(null)

  useEffect(() => {
    const user = authService.getCurrentUser()
    if (!user) {
      router.push('/')
      return
    }
    loadQueueData()
  }, [queueId, router])

  const loadQueueData = async () => {
    try {
      const queues = await queueService.getAllQueues()
      const currentQueue = queues.find(q => q.queue_id === queueId)
      if (currentQueue) {
        setQueue(currentQueue)
        setEntries(currentQueue.entries || [])
      } else {
        router.push('/')
      }
    } catch (error) {
      console.error('Failed to load queue:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const entry = entries.find(e => e.msisdn === event.active.id)
    setActiveEntry(entry || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveEntry(null)

    if (!over) {
      console.log('No drop target')
      return
    }

    const entryId = active.id as string
    const targetColumnId = over.id as string

    console.log('Drag end:', { entryId, targetColumnId, availableColumns: Object.keys(COLUMNS) })

    // Check if dropping on a valid column
    if (Object.keys(COLUMNS).includes(targetColumnId)) {
      const entry = entries.find(e => e.msisdn === entryId)
      
      if (entry && entry.status !== targetColumnId) {
        console.log('Updating status:', { from: entry.status, to: targetColumnId })
        
        // Optimistic update
        setEntries(prev => 
          prev.map(e => 
            e.msisdn === entryId 
              ? { ...e, status: targetColumnId as 'waiting' | 'in_progress' | 'served' }
              : e
          )
        )

        // Update backend
        try {
          const success = await queueService.updateStatus(queueId, entryId, targetColumnId)
          if (!success) {
            console.error('Backend update failed')
            loadQueueData() // Revert on error
          } else {
            console.log('Status updated successfully')
          }
        } catch (error) {
          console.error('Failed to update status:', error)
          // Revert on error
          loadQueueData()
        }
      } else {
        console.log('No change needed or entry not found')
      }
    } else {
      console.log('Invalid drop target')
    }
  }

  const getEntriesByStatus = (status: string) => {
    return entries.filter(entry => entry.status === status && !entry.left)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'served': return 'bg-chart-2/20 text-chart-2 border-2 border-chart-2'
      case 'in_progress': return 'bg-chart-3/20 text-chart-3 border-2 border-chart-3'  
      default: return 'bg-muted text-muted-foreground border-2 border-muted-foreground'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-foreground font-sans">Loading queue...</div>
      </div>
    )
  }

  if (!queue) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-foreground font-sans">Queue not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b-2 border-border bg-card shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                size="sm"
                className="border-2 border-border text-foreground hover:bg-secondary font-mono font-bold"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                BACK
              </Button>
              <div>
                <h1 className="text-2xl font-bold font-sans">{queue.name}</h1>
                <p className="text-muted-foreground text-sm">{queue.description || 'No description'}</p>
              </div>
              <Badge className={`font-mono font-bold ${getStatusColor('active')}`}>
                {entries.filter(e => !e.left).length} ACTIVE
              </Badge>
            </div>
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-2 border-border text-foreground hover:bg-secondary font-mono font-bold uppercase"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  SETTINGS
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-2 border-border text-card-foreground">
                <DialogHeader>
                  <DialogTitle className="font-sans">Queue Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Queue Name</label>
                    <div className="p-3 bg-muted border-2 border-border font-mono">
                      {queue.name}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Queue ID</label>
                    <div className="p-3 bg-muted border-2 border-border font-mono text-sm">
                      {queue.queue_id}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Created</label>
                    <div className="p-3 bg-muted border-2 border-border font-mono text-sm">
                      {new Date(queue.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {Object.entries(COLUMNS).map(([key, column]) => {
              const columnEntries = getEntriesByStatus(key)

              return (
                <DroppableColumn
                  key={key}
                  id={key}
                  title={column.title}
                  icon={column.icon}
                  entries={columnEntries}
                  getStatusColor={getStatusColor}
                />
              )
            })}
          </div>

          <DragOverlay>
            {activeEntry ? <QueueEntryCard entry={activeEntry} isDragging /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}