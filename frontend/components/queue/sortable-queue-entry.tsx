'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { QueueEntryCard } from './queue-entry-card'
import { QueueEntry } from '@/lib/queue-service'

interface SortableQueueEntryProps {
  entry: QueueEntry
  columnId: string
}

export function SortableQueueEntry({ entry, columnId }: SortableQueueEntryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: entry.msisdn,
    data: {
      type: 'entry',
      entry,
      columnId,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-move"
    >
      <QueueEntryCard entry={entry} isDragging={isDragging} />
    </div>
  )
}