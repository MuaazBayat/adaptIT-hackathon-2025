'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Phone, Clock, User } from 'lucide-react'
import { QueueEntry } from '@/lib/queue-service'
import { cn } from '@/lib/utils'

interface QueueEntryCardProps {
  entry: QueueEntry
  isDragging?: boolean
}

export function QueueEntryCard({ entry, isDragging = false }: QueueEntryCardProps) {
  const getTimeAgo = (date: string) => {
    const now = new Date()
    const entryDate = new Date(date)
    const diffMs = now.getTime() - entryDate.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'served': return 'bg-chart-2/20 text-chart-2 border-chart-2'
      case 'in_progress': return 'bg-chart-3/20 text-chart-3 border-chart-3'  
      default: return 'bg-muted text-muted-foreground border-muted-foreground'
    }
  }

  return (
    <Card 
      className={cn(
        "bg-background border-2 border-border shadow transition-all",
        isDragging && "rotate-3 scale-105 shadow-xl",
        "hover:shadow-md"
      )}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono font-bold text-foreground">{entry.msisdn}</span>
            </div>
            <Badge 
              variant="outline" 
              className={cn("text-xs font-mono font-bold uppercase", getStatusColor(entry.status))}
            >
              {entry.status}
            </Badge>
          </div>

          {/* Name if available */}
          {entry.full_name && (
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-card-foreground">{entry.full_name}</span>
            </div>
          )}

          {/* Timing info */}
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Joined: {getTimeAgo(entry.joined_at)}</span>
            </div>
            
            {entry.started_at && (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Started: {getTimeAgo(entry.started_at)}</span>
              </div>
            )}
            
            {entry.served_at && (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Served: {getTimeAgo(entry.served_at)}</span>
              </div>
            )}
          </div>

          {/* Queue time */}
          <div className="text-xs text-muted-foreground border-t border-border pt-2">
            Total time: {getTimeAgo(entry.joined_at)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}