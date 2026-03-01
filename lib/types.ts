export type AgentStatus = 'idle' | 'meal' | 'offline'

export interface Agent {
  id: string
  name: string
  status: AgentStatus
  shift_start: string
  shift_end: string
  meal_start: string | null
  meal_end: string | null
  is_priority: boolean
  is_do_not_assign: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/** Time-only strings in "HH:MM" (24h) format, e.g. "08:00", "16:30" */
export interface AgentFormData {
  name: string
  shift_start: string // "HH:MM"
  shift_end: string   // "HH:MM"
  meal_start: string  // "HH:MM"
}

export interface RotationState {
  id: number
  next_up_agent_id: string | null
  updated_at: string
}

export interface TicketLog {
  id: string
  agent_id: string
  agent_name: string
  action: string
  created_at: string
}
