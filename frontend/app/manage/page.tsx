'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authService, User } from '@/lib/auth'
import { queueService, Queue } from '@/lib/queue-service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Plus, Users, Calendar, Trash2, Copy, Settings, Monitor, ExternalLink, Home, MessageCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ManageQueuesPage() {
  const router = useRouter()
  const [, setUser] = useState<User | null>(null)
  const [queues, setQueues] = useState<Queue[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null)
  const [newQueueName, setNewQueueName] = useState('')
  const [newQueueDescription, setNewQueueDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [sendingAlert, setSendingAlert] = useState(false)

  useEffect(() => {
    const currentUser = authService.getCurrentUser()
    if (!currentUser) {
      router.push('/')
      return
    }
    setUser(currentUser)
    loadQueues()
  }, [router])

  const loadQueues = async () => {
    try {
      const userQueues = await queueService.getAllQueues()
      setQueues(userQueues)
    } catch (error) {
      console.error('Failed to load queues:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQueueName.trim()) return

    setCreating(true)
    try {
      await queueService.createQueue({
        name: newQueueName,
        description: newQueueDescription
      })
      setNewQueueName('')
      setNewQueueDescription('')
      setCreateDialogOpen(false)
      await loadQueues()
      toast.success('Queue created successfully!')
    } catch (error) {
      console.error('Failed to create queue:', error)
      toast.error('Failed to create queue')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteQueue = async (queueId: string) => {
    const success = await queueService.deleteQueue(queueId)
    if (success) {
      await loadQueues()
      setDeleteDialogOpen(null)
      toast.success('Queue deleted successfully!')
    } else {
      toast.error('Failed to delete queue')
    }
  }

  const handleSendAlert = async () => {
    const totalActiveEntries = queues.reduce((total, queue) => {
      return total + (queue.entries?.filter(e => !e.left).length || 0)
    }, 0)

    if (totalActiveEntries === 0) {
      toast.error('No active entries in any queues to send alerts to')
      return
    }

    setSendingAlert(true)
    
    try {
      const result = await queueService.sendAlert()
      
      if (result.success) {
        const totalQueues = result.data?.queues_processed || 0
        let totalMessages = 0
        
        if (result.data?.results) {
          totalMessages = result.data.results.reduce((sum: number, queueResult: { messages_sent?: string[] }) => {
            return sum + (queueResult.messages_sent?.length || 0)
          }, 0)
        }
        
        toast.success(`Alert sent successfully! ${totalMessages} WhatsApp messages sent across ${totalQueues} queue(s).`)
      } else {
        toast.error(`Failed to send alert: ${result.error}`)
      }
    } catch (error) {
      toast.error('Failed to send alert. Please try again.')
      console.error('Send alert error:', error)
    } finally {
      setSendingAlert(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const copyDisplayUrl = (queueId?: string) => {
    const baseUrl = window.location.origin
    const displayUrl = queueId 
      ? `${baseUrl}/display?queue=${queueId}`
      : `${baseUrl}/display`
    copyToClipboard(displayUrl)
  }

  const openDisplayView = (queueId?: string) => {
    const baseUrl = window.location.origin
    const displayUrl = queueId 
      ? `${baseUrl}/display?queue=${queueId}`
      : `${baseUrl}/display`
    window.open(displayUrl, '_blank')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'served': return 'bg-green-500/20 text-green-400 border-2 border-green-400'
      case 'in_progress': return 'bg-blue-500/20 text-blue-400 border-2 border-blue-400'  
      default: return 'bg-orange-500/20 text-orange-400 border-2 border-orange-400'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-foreground font-sans">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
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
                <Home className="mr-2 h-4 w-4" />
                HOME
              </Button>
              <div>
                <h1 className="text-2xl font-bold font-sans">Manage Queues</h1>
                <p className="text-muted-foreground text-sm">Create, edit, and monitor your queue system</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => openDisplayView()}
                className="bg-purple-600 text-white hover:bg-purple-700 border-2 border-border shadow font-mono font-bold uppercase"
              >
                <Monitor className="mr-2 h-4 w-4" />
                ALL QUEUES DISPLAY
              </Button>
              
              {queues.length > 0 && (
                <Button
                  onClick={handleSendAlert}
                  disabled={sendingAlert || queues.every(q => !q.entries?.some(e => !e.left))}
                  className="bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 border-2 border-border shadow font-mono font-bold uppercase"
                >
                  {sendingAlert ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      SENDING...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      SEND ALERT TO ALL
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        
        {/* Create Queue Button */}
        <div className="mb-8">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 border-2 border-border shadow font-mono font-bold uppercase tracking-wider">
                <Plus className="mr-2 h-4 w-4" />
                CREATE NEW QUEUE
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-2 border-border text-card-foreground">
              <DialogHeader>
                <DialogTitle className="font-sans">Create New Queue</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Set up a new queue to manage your customers efficiently.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateQueue} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-card-foreground">Queue Name</Label>
                  <Input
                    id="name"
                    value={newQueueName}
                    onChange={(e) => setNewQueueName(e.target.value)}
                    placeholder="Enter queue name"
                    className="bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:border-ring focus:shadow font-mono"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-card-foreground">Description</Label>
                  <Textarea
                    id="description"
                    value={newQueueDescription}
                    onChange={(e) => setNewQueueDescription(e.target.value)}
                    placeholder="Optional description"
                    className="bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:border-ring focus:shadow resize-none font-mono"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                    className="border-2 border-border text-foreground hover:bg-secondary font-mono font-bold uppercase"
                  >
                    CANCEL
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={creating}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 border-2 border-border shadow font-mono font-bold uppercase"
                  >
                    {creating ? 'CREATING...' : 'CREATE QUEUE'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Queues Grid */}
        {queues.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {queues.map((queue) => {
              const activeEntries = queue.entries?.filter(e => !e.left) || []
              
              return (
                <Card key={queue.queue_id} className="bg-card border-2 border-border shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-card-foreground text-lg">{queue.name}</CardTitle>
                        {queue.description && (
                          <CardDescription className="text-card-foreground/70 text-sm">
                            {queue.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => router.push(`/queue/${queue.queue_id}`)}
                          size="sm"
                          variant="outline"
                          className="border-2 border-border text-foreground hover:bg-secondary font-mono font-bold uppercase text-xs"
                        >
                          <Settings className="mr-1 h-3 w-3" />
                          MANAGE
                        </Button>
                        <AlertDialog open={deleteDialogOpen === queue.queue_id} onOpenChange={(open) => setDeleteDialogOpen(open ? queue.queue_id : null)}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteDialogOpen(queue.queue_id)
                            }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <AlertDialogContent className="bg-card border-2 border-border text-card-foreground">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-sans">Delete Queue</AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground">
                                This action cannot be undone. This will permanently delete the queue &quot;{queue.name}&quot; and all its entries.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-2 border-border text-foreground hover:bg-secondary font-mono font-bold uppercase">
                                CANCEL
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteQueue(queue.queue_id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-2 border-border shadow font-mono font-bold uppercase"
                              >
                                DELETE QUEUE
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Queue Info */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-card-foreground/70">Queue ID</span>
                        <div className="flex items-center space-x-2">
                          <code className="text-card-foreground font-mono bg-muted px-2 py-1 text-xs">
                            {queue.queue_id}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(queue.queue_id)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-card-foreground/70 flex items-center">
                          <Users className="mr-2 h-4 w-4" />
                          Active Entries
                        </span>
                        <Badge variant="secondary" className="bg-secondary text-secondary-foreground border-2 border-border font-mono font-bold">
                          {activeEntries.length}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-card-foreground/70 flex items-center">
                          <Calendar className="mr-2 h-4 w-4" />
                          Created
                        </span>
                        <span className="text-card-foreground font-mono">
                          {new Date(queue.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Display Controls */}
                    <div className="border-t border-border pt-4 space-y-3">
                      <h4 className="text-sm font-medium text-card-foreground font-sans">Queue Display</h4>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => openDisplayView(queue.queue_id)}
                          size="sm"
                          className="bg-purple-600 text-white hover:bg-purple-700 border-2 border-border font-mono font-bold uppercase text-xs"
                        >
                          <Monitor className="mr-1 h-3 w-3" />
                          OPEN DISPLAY
                        </Button>
                        <Button
                          onClick={() => copyDisplayUrl(queue.queue_id)}
                          size="sm"
                          variant="outline"
                          className="border-2 border-border text-foreground hover:bg-secondary font-mono font-bold uppercase text-xs"
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          COPY URL
                        </Button>
                      </div>
                    </div>

                    {/* Recent Entries */}
                    {activeEntries.length > 0 && (
                      <div className="border-t border-border pt-4">
                        <h4 className="text-sm font-medium text-card-foreground mb-2 font-sans">Active Entries</h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {activeEntries.slice(0, 5).map((entry, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-mono">{entry.msisdn}</span>
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs font-mono font-bold uppercase", getStatusColor(entry.status))}
                              >
                                {entry.status}
                              </Badge>
                            </div>
                          ))}
                          {activeEntries.length > 5 && (
                            <div className="text-xs text-muted-foreground text-center pt-1 font-mono">
                              +{activeEntries.length - 5} more entries
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-muted border-2 border-border shadow flex items-center justify-center mb-6">
              <Users className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2 font-sans">No queues yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md text-center">
              Get started by creating your first queue to manage customers efficiently.
            </p>
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 border-2 border-border shadow font-mono font-bold uppercase tracking-wider"
            >
              <Plus className="mr-2 h-4 w-4" />
              CREATE YOUR FIRST QUEUE
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}