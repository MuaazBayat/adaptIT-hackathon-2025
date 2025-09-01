'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { QueueEntry } from '@/lib/queue-service'
import { SortableQueueEntry } from './sortable-queue-entry'
import { cn } from '@/lib/utils'

interface DroppableColumnProps {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  entries: QueueEntry[]
  getStatusColor: (status: string) => string
}

export function DroppableColumn({ id, title, icon: IconComponent, entries, getStatusColor }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  })

  return (
    <Card className="bg-card border-2 border-border shadow-lg min-h-[600px]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-card-foreground">
          <div className="flex items-center space-x-2">
            <IconComponent className="h-5 w-5" />
            <span className="font-mono font-bold uppercase text-lg">{title}</span>
          </div>
          <Badge className={`font-mono font-bold ${getStatusColor(id)}`}>
            {entries.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={setNodeRef}
          className={cn(
            "space-y-3 min-h-[400px] p-4 border-2 border-dashed rounded transition-colors",
            isOver ? "border-primary bg-primary/5" : "border-muted",
            entries.length === 0 && "flex items-center justify-center"
          )}
        >
          <SortableContext
            items={entries.map(e => e.msisdn)}
            strategy={verticalListSortingStrategy}
          >
            {entries.length > 0 ? (
              entries.map((entry) => (
                <SortableQueueEntry
                  key={entry.msisdn}
                  entry={entry}
                  columnId={id}
                />
              ))
            ) : (
              <div className="text-muted-foreground text-sm font-mono">
                DROP ENTRIES HERE
              </div>
            )}
          </SortableContext>
        </div>
      </CardContent>
    </Card>
  )
}