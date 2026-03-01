'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { AgentCard } from '@/components/agent-card'
import type { Agent, AgentTeam } from '@/lib/types'
import { useState } from 'react'

interface TeamColumnProps {
  id: AgentTeam
  title: string
  agents: Agent[]
  nextUpAgentId: string | null
  onStatusChange: (agentId: string, status: string) => void
  onUpdateMealTime?: (agentId: string, mealStart: string) => void
  onSetNextUp?: (agent: Agent) => void
}

function TeamColumn({ id, title, agents, nextUpAgentId, onStatusChange, onUpdateMealTime, onSetNextUp }: TeamColumnProps) {
  const { setNodeRef } = useDroppable({ id })
  
  return (
    <div className="flex flex-col gap-3 min-w-[280px] flex-1 bg-secondary/20 p-3 rounded-lg border border-border">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
        <span className="text-xs text-muted-foreground">{agents.length} agents</span>
      </div>
      
      <div ref={setNodeRef} className="flex flex-col gap-3 min-h-[150px]">
        <SortableContext items={agents.map((a) => a.id)} strategy={rectSortingStrategy}>
          {agents.map((agent, index) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isNextUp={agent.id === nextUpAgentId}
              onStatusChange={onStatusChange}
              onUpdateMealTime={onUpdateMealTime}
              onSetNextUp={onSetNextUp}
              sortOrder={index + 1}
            />
          ))}
        </SortableContext>
        {agents.length === 0 && (
          <div className="flex items-center justify-center p-4 border border-dashed rounded-lg border-muted-foreground/30 text-xs text-muted-foreground">
            Drop agents here
          </div>
        )}
      </div>
    </div>
  )
}

interface SortableAgentGridProps {
  agents: Agent[]
  rotations: Record<string, any>
  onStatusChange: (agentId: string, status: string) => void
  onUpdateMealTime?: (agentId: string, mealStart: string) => void
  onSetNextUp?: (agent: Agent) => void
  onReorder: (reorderedAgents: Agent[]) => void
}

export function SortableAgentGrid({
  agents,
  rotations,
  onStatusChange,
  onUpdateMealTime,
  onSetNextUp,
  onReorder,
}: SortableAgentGridProps) {
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null)
  
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
  
  const teams: AgentTeam[] = ['PST', 'UK', 'Beginner']
  
  const getTeamAgents = (team: AgentTeam) => sorted.filter((a) => a.team === team)

  function handleDragStart(event: any) {
    const { active } = event
    const agent = agents.find((a) => a.id === active.id)
    if (agent) setActiveAgent(agent)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveAgent(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const activeAgent = sorted.find((a) => a.id === activeId)
    if (!activeAgent) return

    let nextTeam = activeAgent.team
    let targetIndex = -1

    const isOverContainer = teams.includes(over.id as AgentTeam)
    if (isOverContainer) {
      nextTeam = over.id as AgentTeam
      targetIndex = getTeamAgents(nextTeam).length
    } else {
      const overAgent = sorted.find((a) => a.id === over.id)
      if (overAgent) {
        nextTeam = overAgent.team
        const teamAgents = getTeamAgents(nextTeam)
        targetIndex = teamAgents.findIndex((a) => a.id === over.id)
      }
    }

    if (activeAgent.team === nextTeam && !isOverContainer) {
      const teamAgents = getTeamAgents(nextTeam)
      const oldIndex = teamAgents.findIndex((a) => a.id === active.id)
      if (oldIndex === targetIndex) return

      const reordered = [...teamAgents]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(targetIndex, 0, moved)
      onReorder(reordered)
    } else if (activeAgent.team !== nextTeam) {
      const targetAgents = getTeamAgents(nextTeam)
      const newAgent = { ...activeAgent, team: nextTeam }
      const reordered = [...targetAgents]
      
      if (targetIndex === -1) {
        reordered.push(newAgent)
      } else {
        reordered.splice(targetIndex, 0, newAgent)
      }
      
      onReorder(reordered)
    }
  }

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }),
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto pb-4">
        {teams.map((team) => (
          <TeamColumn
            key={team}
            id={team}
            title={`${team} Queue`}
            agents={getTeamAgents(team)}
            nextUpAgentId={rotations[team]?.next_up_agent_id ?? null}
            onStatusChange={onStatusChange}
            onUpdateMealTime={onUpdateMealTime}
            onSetNextUp={onSetNextUp}
          />
        ))}
      </div>
      
      <DragOverlay dropAnimation={dropAnimation}>
        {activeAgent ? (
          <AgentCard
            agent={activeAgent}
            isNextUp={false}
            onStatusChange={() => {}}
            sortOrder={0}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
