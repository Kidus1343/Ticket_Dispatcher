'use client'

import { cn } from '@/lib/utils'
import type { Agent, AgentStatus } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  CircleCheck,
  UtensilsCrossed,
  WifiOff,
  Clock,
  Zap,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { toast } from 'sonner'

interface AgentCardProps {
  agent: Agent & {
    aboutToMeal?: boolean
    aboutFromMeal?: boolean
    aboutToStartShift?: boolean
    aboutToEndShift?: boolean
  }
  isNextUp: boolean
  onStatusChange: (agentId: string, status: string) => void
  onUpdateMealTime?: (agentId: string, mealStart: string) => void
  sortOrder: number
}

const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  idle: {
    label: 'Idle',
    icon: <CircleCheck className="size-3.5" />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border-emerald-400/20',
  },
  meal: {
    label: 'Meal',
    icon: <UtensilsCrossed className="size-3.5" />,
    color: 'text-sky-400',
    bg: 'bg-sky-400/10 border-sky-400/20',
  },
  offline: {
    label: 'Offline',
    icon: <WifiOff className="size-3.5" />,
    color: 'text-neutral-500',
    bg: 'bg-neutral-500/10 border-neutral-500/20',
  },
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getTimeRemaining(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  if (hrs > 0) return `${hrs}h ${mins % 60}m`
  return `${mins}m`
}

export function AgentCard({
  agent,
  isNextUp,
  onStatusChange,
  onUpdateMealTime,
  sortOrder,
}: AgentCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: agent.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const config =
    STATUS_CONFIG[agent.status as AgentStatus] ?? STATUS_CONFIG.offline
  const timeToEnd = new Date(agent.shift_end).getTime() - Date.now()
  const isCooldown = agent.is_do_not_assign
  const isPriority = agent.is_priority

  const statuses: AgentStatus[] = ['idle', 'meal', 'offline']

  // Edit meal modal
  const [editMealOpen, setEditMealOpen] = useState(false)
  const [mealInput, setMealInput] = useState('')

  const handleEditMealClick = () => {
    if (agent.meal_start) {
      const mealTime = new Date(agent.meal_start)
      const hh = String(mealTime.getHours()).padStart(2, '0')
      const mm = String(mealTime.getMinutes()).padStart(2, '0')
      setMealInput(`${hh}:${mm}`)
    }
    setEditMealOpen(true)
  }

  const handleSaveMealTime = () => {
    if (!mealInput || !onUpdateMealTime) return
    if (!/^\d{2}:\d{2}$/.test(mealInput)) {
      toast.error('Use HH:MM format')
      return
    }
    onUpdateMealTime(agent.id, mealInput)
    setEditMealOpen(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'relative flex flex-col gap-3 rounded-lg border p-3 transition-all cursor-grab active:cursor-grabbing touch-none',
        'bg-card',
        isNextUp && !isCooldown && 'border-primary/60 ring-2 ring-primary/40 shadow-lg shadow-primary/10',
        isPriority && !isCooldown && 'border-amber-400/60 ring-2 ring-amber-400/40 shadow-lg shadow-amber-400/10',
        agent.aboutToMeal && 'border-orange-400/60 ring-2 ring-orange-400/40 shadow-lg shadow-orange-400/10',
        agent.aboutFromMeal && 'border-violet-400/60 ring-2 ring-violet-400/40 shadow-lg shadow-violet-400/10',
        agent.aboutToStartShift && 'border-cyan-400/60 ring-2 ring-cyan-400/40 shadow-lg shadow-cyan-400/10',
        agent.aboutToEndShift && 'border-red-400/60 ring-2 ring-red-400/40 shadow-lg shadow-red-400/10',
        isCooldown && 'border-destructive/60 ring-2 ring-destructive/40 shadow-lg shadow-destructive/10 opacity-70',
        isDragging && 'opacity-60 z-50 shadow-2xl shadow-primary/20',
      )}
    >
      {/* Top row: sort order + name + flags */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Sort order badge */}
          <span className="text-[10px] font-mono font-bold text-muted-foreground shrink-0 w-5 text-center">
            {sortOrder}
          </span>
          <div
            className={cn(
              'size-2 shrink-0 rounded-full',
              agent.status === 'idle' && 'bg-emerald-400',
              agent.status === 'meal' && 'bg-sky-400',
              agent.status === 'offline' && 'bg-neutral-500',
            )}
          />
          <span className="text-sm font-semibold text-foreground truncate">
            {agent.name}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isNextUp && !isCooldown && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="gap-1 bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 py-0"
                >
                  <ArrowRight className="size-2.5" />
                  <span className="sr-only">Next up in rotation</span>
                  NEXT
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Next up in rotation</TooltipContent>
            </Tooltip>
          )}
          {isPriority && !isCooldown && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="gap-1 bg-amber-400/15 text-amber-400 border-amber-400/30 text-[10px] px-1.5 py-0"
                >
                  <Zap className="size-2.5" />
                  <span className="sr-only">Priority warm-up</span>
                  PRI
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Warm-up priority: starting shift or returning from meal within 10 min
              </TooltipContent>
            </Tooltip>
          )}
          {isCooldown && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="gap-1 bg-destructive/15 text-destructive border-destructive/30 text-[10px] px-1.5 py-0"
                >
                  <AlertTriangle className="size-2.5" />
                  <span className="sr-only">Shift ending soon</span>
                  END
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Shift ends in &lt;= 10 minutes</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        {agent.status === 'meal' ? (
          <button
            onClick={handleEditMealClick}
            className={cn(
              'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors',
              'cursor-pointer hover:bg-sky-400/20 hover:border-sky-400/40',
              config.color,
              config.bg,
            )}
            title="Click to edit meal time"
          >
            {config.icon}
            {config.label}
          </button>
        ) : (
          <Badge
            variant="outline"
            className={cn(
              'gap-1 text-[10px] px-1.5 py-0',
              config.color,
              config.bg,
            )}
          >
            {config.icon}
            {config.label}
          </Badge>
        )}
      </div>

      {/* Shift info */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="size-3" />
          <span>Ends {formatTime(agent.shift_end)}</span>
        </div>
        <span
          className={cn(
            agent.aboutToEndShift && 'text-red-400 font-medium animate-pulse',
            timeToEnd > 0 &&
              timeToEnd <= 600000 &&
              !agent.aboutToEndShift &&
              'text-destructive font-medium',
          )}
        >
          {timeToEnd > 0 ? getTimeRemaining(agent.shift_end) : 'Ended'}
        </span>
      </div>

      {/* Meal indicators */}
      {agent.meal_start && (
        <div className={cn(
          'flex items-center gap-1 text-[11px] px-1 py-0.5 rounded',
          agent.aboutToMeal && 'bg-orange-400/10 text-orange-400 animate-pulse',
          agent.aboutFromMeal && 'bg-violet-400/10 text-violet-400 animate-pulse',
          !agent.aboutToMeal && !agent.aboutFromMeal && 'text-muted-foreground',
        )}>
          <UtensilsCrossed className="size-3" />
          <span>{formatTime(agent.meal_start)} - {formatTime(agent.meal_end || '')}</span>
        </div>
      )}

      {/* Shift start indicator */}
      {agent.aboutToStartShift && (
        <div className="flex items-center gap-1 text-[11px] px-1 py-0.5 rounded bg-cyan-400/10 text-cyan-400 animate-pulse">
          <Clock className="size-3" />
          <span>Shift starts in {getTimeRemaining(agent.shift_start)}</span>
        </div>
      )}

      {/* Status toggle row */}
      <div className="flex items-center gap-1 pt-1 border-t border-border">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => onStatusChange(agent.id, s)}
            className={cn(
              'flex-1 rounded px-1 py-0.5 text-[10px] font-medium transition-colors',
              agent.status === s
                ? cn(
                    s === 'idle' && 'bg-emerald-400/20 text-emerald-400',
                    s === 'meal' && 'bg-sky-400/20 text-sky-400',
                    s === 'offline' && 'bg-neutral-500/20 text-neutral-500',
                  )
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            )}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Edit Meal Time Modal */}
      <Dialog open={editMealOpen} onOpenChange={setEditMealOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Edit Meal Time for {agent.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="meal-time">Meal Start (HH:MM)</Label>
              <Input
                id="meal-time"
                type="time"
                value={mealInput}
                onChange={(e) => setMealInput(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditMealOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveMealTime}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
