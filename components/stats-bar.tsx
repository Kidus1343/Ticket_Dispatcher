'use client'

import type { Agent } from '@/lib/types'
import {
  CircleCheck,
  UtensilsCrossed,
  WifiOff,
  Zap,
  ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsBarProps {
  agents: Agent[]
}

export function StatsBar({ agents }: StatsBarProps) {
  const idle = agents.filter((a) => a.status === 'idle').length
  const meal = agents.filter((a) => a.status === 'meal').length
  const offline = agents.filter((a) => a.status === 'offline').length
  const priority = agents.filter((a) => a.is_priority && !a.is_do_not_assign).length
  const dna = agents.filter((a) => a.is_do_not_assign).length

  const stats = [
    {
      label: 'Idle',
      value: idle,
      icon: <CircleCheck className="size-3.5" />,
      color: 'text-emerald-400',
    },
    {
      label: 'Meal',
      value: meal,
      icon: <UtensilsCrossed className="size-3.5" />,
      color: 'text-sky-400',
    },
    {
      label: 'Offline',
      value: offline,
      icon: <WifiOff className="size-3.5" />,
      color: 'text-neutral-500',
    },
    {
      label: 'Priority',
      value: priority,
      icon: <Zap className="size-3.5" />,
      color: 'text-amber-400',
    },
    {
      label: 'DNA',
      value: dna,
      icon: <ShieldAlert className="size-3.5" />,
      color: 'text-destructive',
    },
  ]

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-1.5">
          <span className={cn(stat.color)}>{stat.icon}</span>
          <span className="text-xs font-mono font-semibold text-foreground">
            {stat.value}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  )
}
