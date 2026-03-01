'use client'

import { Button } from '@/components/ui/button'
import type { Agent } from '@/lib/types'
import {
  TicketCheck,
  PhoneForwarded,
  ArrowRight,
  Zap,
  ShieldAlert,
  UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DispatchControlsProps {
  nextUpAgent: Agent | null
  activeDispatcherName: string | null
  onAssign: () => void
  onDirectCall: () => void
}

export function DispatchControls({
  nextUpAgent,
  activeDispatcherName,
  onAssign,
  onDirectCall,
}: DispatchControlsProps) {
  const canAssign =
    nextUpAgent &&
    nextUpAgent.status === 'idle' &&
    !nextUpAgent.is_do_not_assign

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <ArrowRight className="size-3.5" />
        Dispatch Controls
      </div>

      {/* Active dispatcher badge */}
      {activeDispatcherName && (
        <div className="flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1.5 text-xs text-primary">
          <UserCheck className="size-3.5 shrink-0" />
          <span className="font-medium truncate">{activeDispatcherName}</span>
          <span className="text-primary/60 text-[10px] shrink-0">dispatching</span>
        </div>
      )}

      {/* Current "Next Up" display */}
      <div className="rounded-md border border-border bg-secondary/50 p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          Next Up
        </div>
        {nextUpAgent ? (
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'size-2.5 rounded-full',
                nextUpAgent.status === 'idle' && 'bg-emerald-400',
                nextUpAgent.status === 'meal' && 'bg-sky-400',
                nextUpAgent.status === 'offline' && 'bg-neutral-500',
              )}
            />
            <span className="text-sm font-semibold text-foreground">
              {nextUpAgent.name}
            </span>
            {nextUpAgent.is_priority && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                <Zap className="size-3" />
                Priority
              </span>
            )}
            {nextUpAgent.is_do_not_assign && (
              <span className="flex items-center gap-0.5 text-[10px] text-destructive">
                <ShieldAlert className="size-3" />
                DNA
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            No eligible agents
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={onAssign}
          disabled={!canAssign}
          className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          size="sm"
        >
          <TicketCheck className="size-4" />
          Assign Ticket
        </Button>
        <Button
          onClick={onDirectCall}
          disabled={!nextUpAgent}
          variant="outline"
          className="flex-1 gap-2"
          size="sm"
        >
          <PhoneForwarded className="size-4" />
          Direct Call
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        <strong>Assign:</strong> Sends Salesforce ticket to Next Up, advances pointer.{' '}
        <strong>Direct Call:</strong> Skips agent (Genesys call), advances pointer.
      </p>
    </div>
  )
}
