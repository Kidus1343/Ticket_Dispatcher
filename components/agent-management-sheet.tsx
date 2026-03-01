'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Agent, AgentFormData } from '@/lib/types'
import {
  UserPlus,
  Pencil,
  Trash2,
  Clock,
  UtensilsCrossed,
  Save,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentManagementSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: Agent[]
  onAddAgent: (form: AgentFormData) => Promise<void>
  onUpdateAgent: (agentId: string, form: AgentFormData) => Promise<void>
  onRemoveAgent: (agentId: string) => Promise<void>
}

/** Add N hours to a "HH:MM" string, wrapping around 24h */
function addHours(hhmm: string, hours: number): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const total = (h + hours) % 24
  return `${total.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/** Convert an ISO date string to "HH:MM" in the user's local timezone */
function isoToTimeStr(isoStr: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

/** Format "HH:MM" 24h to a human-readable 12h time like "8:00 AM" */
function formatHHMM(hhmm: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h % 12 || 12
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const emptyForm: AgentFormData = {
  name: '',
  shift_start: '',
  shift_end: '',
  meal_start: '',
}

export function AgentManagementSheet({
  open,
  onOpenChange,
  agents,
  onAddAgent,
  onUpdateAgent,
  onRemoveAgent,
}: AgentManagementSheetProps) {
  const [form, setForm] = useState<AgentFormData>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  const handleShiftStartChange = (value: string) => {
    const newForm = { ...form, shift_start: value }
    // Auto-calculate shift end as +8 hours if not manually set or still default
    if (!form.shift_end || form.shift_end === addHours(form.shift_start, 8)) {
      newForm.shift_end = addHours(value, 8)
    }
    // Auto-calculate meal time as +4 hours if not manually set or still default
    if (!form.meal_start || form.meal_start === addHours(form.shift_start, 4)) {
      newForm.meal_start = addHours(value, 4)
    }
    setForm(newForm)
  }

  const handleSubmit = async () => {
    if (
      !form.name.trim() ||
      !form.shift_start ||
      !form.shift_end ||
      !form.meal_start
    ) {
      return
    }
    setSubmitting(true)
    try {
      if (editingId) {
        await onUpdateAgent(editingId, form)
      } else {
        await onAddAgent(form)
      }
      resetForm()
    } catch (err) {
      console.error('[v0] handleSubmit error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (agent: Agent) => {
    setForm({
      name: agent.name,
      shift_start: isoToTimeStr(agent.shift_start),
      shift_end: isoToTimeStr(agent.shift_end),
      meal_start: isoToTimeStr(agent.meal_start),
    })
    setEditingId(agent.id)
    setShowForm(true)
  }

  const handleDelete = async (agent: Agent) => {
    await onRemoveAgent(agent.id)
    if (editingId === agent.id) {
      resetForm()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col bg-card"
      >
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle className="text-foreground">Agent Management</SheetTitle>
          <SheetDescription>
            Add agents with their daily schedule. Lunch defaults to 4h after
            shift start (1 hour break). Runs Mon-Fri.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Add New button */}
          {!showForm && (
            <div className="px-6 py-3">
              <Button
                onClick={() => {
                  resetForm()
                  setShowForm(true)
                }}
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                size="sm"
              >
                <UserPlus className="size-4" />
                Add New Agent
              </Button>
            </div>
          )}

          {/* Form */}
          {showForm && (
            <div className="px-6 py-3">
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {editingId ? 'Edit Agent' : 'New Agent'}
                  </span>
                  <button
                    onClick={resetForm}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="size-4" />
                    <span className="sr-only">Cancel</span>
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {/* Name */}
                  <div>
                    <Label
                      htmlFor="agent-name"
                      className="text-xs text-muted-foreground mb-1"
                    >
                      Agent Name
                    </Label>
                    <Input
                      id="agent-name"
                      placeholder="e.g. Marcus Chen"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      className="h-8 text-sm bg-background"
                    />
                  </div>

                  {/* Shift Start / End -- TIME only */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label
                        htmlFor="shift-start"
                        className="text-xs text-muted-foreground mb-1"
                      >
                        <Clock className="size-3 inline mr-1" />
                        Shift Start
                      </Label>
                      <Input
                        id="shift-start"
                        type="time"
                        value={form.shift_start}
                        onChange={(e) =>
                          handleShiftStartChange(e.target.value)
                        }
                        className="h-8 text-sm bg-background"
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="shift-end"
                        className="text-xs text-muted-foreground mb-1"
                      >
                        <Clock className="size-3 inline mr-1" />
                        Shift End
                      </Label>
                      <Input
                        id="shift-end"
                        type="time"
                        value={form.shift_end}
                        onChange={(e) =>
                          setForm({ ...form, shift_end: e.target.value })
                        }
                        className="h-8 text-sm bg-background"
                      />
                    </div>
                  </div>

                  {/* Lunch Break -- TIME only */}
                  <div>
                    <Label
                      htmlFor="meal-start"
                      className="text-xs text-muted-foreground mb-1"
                    >
                      <UtensilsCrossed className="size-3 inline mr-1" />
                      Lunch Break Start (1 hour)
                    </Label>
                    <Input
                      id="meal-start"
                      type="time"
                      value={form.meal_start}
                      onChange={(e) =>
                        setForm({ ...form, meal_start: e.target.value })
                      }
                      className="h-8 text-sm bg-background"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Auto-set to 4h after shift start. Editable.
                    </p>
                  </div>

                  {/* Preview */}
                  {form.shift_start && form.shift_end && form.meal_start && (
                    <div className="rounded border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Preview:
                      </span>{' '}
                      {formatHHMM(form.shift_start)} -{' '}
                      {formatHHMM(form.shift_end)} | Lunch at{' '}
                      {formatHHMM(form.meal_start)}
                    </div>
                  )}

                  <Button
                    onClick={handleSubmit}
                    disabled={
                      submitting ||
                      !form.name.trim() ||
                      !form.shift_start ||
                      !form.shift_end ||
                      !form.meal_start
                    }
                    size="sm"
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Save className="size-3.5" />
                    {editingId ? 'Save Changes' : 'Add Agent'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Existing agents list */}
          <div className="px-6 pt-3 pb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current Roster ({agents.length})
            </span>
          </div>

          <ScrollArea className="flex-1 px-6 pb-4">
            {agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <UserPlus className="size-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No agents yet</p>
                <p className="text-xs text-muted-foreground/70">
                  Click &quot;Add New Agent&quot; to get started
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pr-3">
                {agents
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((agent, index) => (
                    <div
                      key={agent.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border border-border bg-secondary/20 px-3 py-2.5 transition-colors',
                        editingId === agent.id &&
                          'border-primary/50 bg-primary/5',
                      )}
                    >
                      {/* Order number */}
                      <span className="text-xs font-mono font-bold text-muted-foreground w-5 text-center shrink-0">
                        {index + 1}
                      </span>

                      {/* Agent info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">
                          {agent.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-0.5">
                            <Clock className="size-2.5" />
                            {formatTime(agent.shift_start)} -{' '}
                            {formatTime(agent.shift_end)}
                          </span>
                          {agent.meal_start && (
                            <span className="flex items-center gap-0.5">
                              <UtensilsCrossed className="size-2.5" />
                              {formatTime(agent.meal_start)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleEdit(agent)}
                          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          aria-label={`Edit ${agent.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(agent)}
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label={`Remove ${agent.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
