'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { AgentCard } from '@/components/agent-card'
import type { Agent } from '@/lib/types'

interface SortableAgentGridProps {
  agents: Agent[]
  nextUpAgentId: string | null
  onStatusChange: (agentId: string, status: string) => void
  onUpdateMealTime?: (agentId: string, mealStart: string) => void
  onReorder: (reorderedAgents: Agent[]) => void
}

export function SortableAgentGrid({
  agents,
  nextUpAgentId,
  onStatusChange,
  onUpdateMealTime,
  onReorder,
}: SortableAgentGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const sorted = [...agents].sort((a, b) => a.sort_order - b.sort_order)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sorted.findIndex((a) => a.id === active.id)
    const newIndex = sorted.findIndex((a) => a.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...sorted]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    onReorder(reordered)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sorted.map((a) => a.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {sorted.map((agent, index) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isNextUp={agent.id === nextUpAgentId}
              onStatusChange={onStatusChange}
              onUpdateMealTime={onUpdateMealTime}
              sortOrder={index + 1}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
