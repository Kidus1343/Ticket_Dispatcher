'use client'

import { useDispatcher } from '@/hooks/use-dispatcher'
import { SortableAgentGrid } from '@/components/sortable-agent-grid'
import { DispatchControls } from '@/components/dispatch-controls'
import { ActivityLog } from '@/components/activity-log'
import { StatsBar } from '@/components/stats-bar'
import { AgentManagementSheet } from '@/components/agent-management-sheet'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Radio, Wifi, RefreshCw, Settings, GripVertical, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

function LiveClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
      )
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="font-mono text-sm text-foreground tabular-nums">
      {time}
    </span>
  )
}

export function CockpitDashboard() {
  const {
    agents,
    rotation,
    logs,
    loading,
    assignTicket,
    directCall,
    updateAgentStatus,
    updateMealTime,
    addAgent,
    updateAgent,
    removeAgent,
    reorderAgents,
  } = useDispatcher()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeDispatcher, setActiveDispatcher] = useState<string>('')

  const nextUpAgent =
    agents.find((a) => a.id === rotation?.next_up_agent_id) ?? null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="size-5 animate-spin" />
          <span className="text-sm">Loading dispatcher cockpit...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Radio className="size-5 text-primary" />
              <h1 className="text-base font-bold text-foreground tracking-tight">
                Ticket Dispatcher
              </h1>
            </div>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              L1 Help Desk
            </span>
          </div>

          <div className="flex items-center gap-2">
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSheetOpen(true)}
              className="gap-2 text-xs h-8"
            >
              <Settings className="size-3.5" />
              <span className="hidden sm:inline">Manage Agents</span>
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <Wifi className="size-3.5" />
              <span className="hidden sm:inline">Realtime</span>
            </div>
            <LiveClock />
          </div>
        </div>

        {/* Stats row */}
        <div className="border-t border-border px-4 py-2 lg:px-6">
          <StatsBar agents={agents} />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4 lg:p-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Agent grid */}
          <section className="flex-1">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Agent Rotation Board</span>
                <span className="text-[10px] font-normal">
                  ({agents.length} agents)
                </span>
              </div>
              {agents.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <GripVertical className="size-3" />
                  <span>Drag to reorder rotation</span>
                </div>
              )}
            </div>

            {agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
                <Settings className="size-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No agents configured
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
                  Add agents with their shift schedules to get started
                </p>
                <Button
                  onClick={() => setSheetOpen(true)}
                  size="sm"
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Settings className="size-3.5" />
                  Manage Agents
                </Button>
              </div>
            ) : (
              <SortableAgentGrid
                agents={agents}
                nextUpAgentId={rotation?.next_up_agent_id ?? null}
                onStatusChange={updateAgentStatus}
                onUpdateMealTime={updateMealTime}
                onReorder={reorderAgents}
              />
            )}
          </section>

          {/* Sidebar: controls + log */}
          <aside className="flex w-full flex-col gap-4 lg:w-80 xl:w-96 shrink-0">
            <DispatchControls
              nextUpAgent={nextUpAgent}
              activeDispatcherName={
                agents.find((a) => a.id === activeDispatcher)?.name ?? null
              }
              onAssign={assignTicket}
              onDirectCall={directCall}
            />
            <ActivityLog logs={logs} />

            {/* Legend */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                10-Minute Rules
              </div>
              <div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground leading-relaxed">
                <p>
                  <span className="font-semibold text-amber-400">
                    Warm-up (PRI):
                  </span>{' '}
                  Agent starting shift or returning from meal in {'<='} 10 min
                  gets priority for the next ticket.
                </p>
                <p>
                  <span className="font-semibold text-destructive">
                    Cool-down (DNA):
                  </span>{' '}
                  Agent whose shift ends in {'<='} 10 min is excluded from
                  rotation.
                </p>
              </div>
            </div>

            {/* Reorder hint */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Rotation Reorder
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                If an agent creates an unassigned Salesforce ticket, drag their
                card in the grid to the correct position in the rotation. The
                &quot;Next Up&quot; pointer stays on the same agent by ID.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* Agent Management Sheet */}
      <AgentManagementSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        agents={agents}
        onAddAgent={addAgent}
        onUpdateAgent={updateAgent}
        onRemoveAgent={removeAgent}
      />
    </div>
  )
}
