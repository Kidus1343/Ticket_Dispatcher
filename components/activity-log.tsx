'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import type { TicketLog } from '@/lib/types'
import { TicketCheck, PhoneForwarded, History, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ActivityLogProps {
  logs: TicketLog[]
  onReset: () => void
}

function formatLogTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

export function ActivityLog({ logs, onReset }: ActivityLogProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <History className="size-3.5" />
          Activity Log
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={onReset}
        >
          <Trash2 className="size-3.5 mr-1" />
          Reset
        </Button>
      </div>

      <ScrollArea className="h-[280px]">
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No activity yet
          </p>
        ) : (
          <div className="flex flex-col gap-1 pr-3">
            {logs.map((log) => {
              const isAssign = log.action.includes('assigned')
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/50 transition-colors"
                >
                  <div
                    className={cn(
                      'mt-0.5 shrink-0',
                      isAssign ? 'text-primary' : 'text-amber-400',
                    )}
                  >
                    {isAssign ? (
                      <TicketCheck className="size-3.5" />
                    ) : (
                      <PhoneForwarded className="size-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">
                      {log.agent_name}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}{log.action.replace('Salesforce ticket assigned', '- SF ticket').replace('Skipped - Direct phone call (Genesys)', '- Skipped (Genesys call)')}
                    </span>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground font-mono">
                    {formatLogTime(log.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
