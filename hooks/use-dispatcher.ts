'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Agent, AgentFormData, RotationState, TicketLog } from '@/lib/types'
import { toast } from 'sonner'

export function useDispatcher() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [rotation, setRotation] = useState<RotationState | null>(null)
  const [logs, setLogs] = useState<TicketLog[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])
  const tickRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch initial data
  const fetchData = useCallback(async () => {
    const [agentsRes, rotationRes, logsRes] = await Promise.all([
      supabase.from('agents').select('*').order('sort_order'),
      supabase.from('rotation_state').select('*').eq('id', 1).maybeSingle(),
      supabase
        .from('ticket_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (agentsRes.data) setAgents(agentsRes.data)
    if (rotationRes.data) setRotation(rotationRes.data)
    if (logsRes.data) setLogs(logsRes.data)
    setLoading(false)
  }, [supabase])

  // 10-minute rule evaluation (includes 5-minute transition logic)
  const evaluateRules = useCallback((agentList: Agent[]) => {
    const now = new Date()
    const tenMin = 10 * 60 * 1000
    const fiveMin = 5 * 60 * 1000

    return agentList.map((agent) => {
      const shiftEnd = new Date(agent.shift_end)
      const shiftStart = new Date(agent.shift_start)
      const mealStart = agent.meal_start ? new Date(agent.meal_start) : null
      const mealEnd = agent.meal_end ? new Date(agent.meal_end) : null
      const timeToEnd = shiftEnd.getTime() - now.getTime()
      const timeToStart = shiftStart.getTime() - now.getTime()
      const timeToMealStart = mealStart ? mealStart.getTime() - now.getTime() : null
      const timeToMealEnd = mealEnd ? mealEnd.getTime() - now.getTime() : null

      // **PRIORITY (Warm-up) Rules:**
      // 1. Shift starts in <= 10 minutes
      // 2. OR returning from meal in <= 10 minutes
      const isWarmupShift = timeToStart > 0 && timeToStart <= tenMin
      const isWarmupMeal = timeToMealEnd !== null && timeToMealEnd > 0 && timeToMealEnd <= tenMin
      const isPriority = isWarmupShift || isWarmupMeal

      // **DNA (Cool-down) Rule:**
      // Shift ends in <= 10 minutes - excluded from rotation
      const isDNA = timeToEnd > 0 && timeToEnd <= tenMin

      // **5-minute transition flags - VISUAL HIGHLIGHTS ONLY, do not affect assignment**
      const aboutToStartShift = timeToStart > 0 && timeToStart <= fiveMin
      const aboutFromMeal = timeToMealEnd !== null && timeToMealEnd > 0 && timeToMealEnd <= fiveMin
      const aboutToMeal = timeToMealStart !== null && timeToMealStart > 0 && timeToMealStart <= fiveMin
      const aboutToEndShift = timeToEnd > 0 && timeToEnd <= fiveMin

      return {
        ...agent,
        is_priority: isPriority,
        is_do_not_assign: isDNA,
        // Store transition flags on agent for UI highlighting
        aboutToMeal,
        aboutFromMeal,
        aboutToStartShift,
        aboutToEndShift,
      } as Agent & { aboutToMeal: boolean; aboutFromMeal: boolean; aboutToStartShift: boolean; aboutToEndShift: boolean }
    })
  }, [])

  // Re-evaluate the 10-minute rules every 15 seconds
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setAgents((prev) => evaluateRules(prev))
    }, 15000)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [evaluateRules])

  // Subscribe to Realtime changes
  useEffect(() => {
    const init = async () => {
      await fetchData()

      // Ensure rotation_state has at least one row
      const { data: rotData } = await supabase
        .from('rotation_state')
        .select('*')
        .eq('id', 1)
        .maybeSingle()

      if (!rotData) {
        await supabase
          .from('rotation_state')
          .insert({ id: 1, next_up_agent_id: null, updated_at: new Date().toISOString() })
      }
    }

    init()

    const agentChannel = supabase
      .channel('agents-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agents' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setAgents((prev) =>
              evaluateRules(
                prev
                  .map((a) =>
                    a.id === (payload.new as Agent).id
                      ? (payload.new as Agent)
                      : a,
                  )
                  .sort((a, b) => a.sort_order - b.sort_order),
              ),
            )
          } else if (payload.eventType === 'INSERT') {
            setAgents((prev) =>
              evaluateRules(
                [...prev, payload.new as Agent].sort(
                  (a, b) => a.sort_order - b.sort_order,
                ),
              ),
            )
          } else if (payload.eventType === 'DELETE') {
            setAgents((prev) =>
              prev.filter((a) => a.id !== (payload.old as Agent).id),
            )
          }
        },
      )
      .subscribe()

    const rotationChannel = supabase
      .channel('rotation-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rotation_state' },
        (payload) => {
          setRotation(payload.new as RotationState)
        },
      )
      .subscribe()

    const logChannel = supabase
      .channel('log-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_log' },
        (payload) => {
          setLogs((prev) => [payload.new as TicketLog, ...prev].slice(0, 50))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(agentChannel)
      supabase.removeChannel(rotationChannel)
      supabase.removeChannel(logChannel)
    }
  }, [fetchData, evaluateRules, supabase])

  // Apply rules on initial load
  useEffect(() => {
    if (!loading && agents.length > 0) {
      setAgents((prev) => evaluateRules(prev))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // Get eligible agents (idle, not meal, not offline)
  const getEligibleAgents = useCallback((agentList: Agent[]) => {
    return agentList.filter((a) => a.status === 'idle')
  }, [])

  // Find the next eligible agent from the current pointer position
  const findNextEligible = useCallback(
    (agentList: Agent[], currentAgentId: string | null): Agent | null => {
      const evaluated = evaluateRules(agentList)

      // Check for priority agents first
      const priorityAgents = evaluated.filter(
        (a) => a.is_priority && !a.is_do_not_assign,
      )
      if (priorityAgents.length > 0) return priorityAgents[0]

      const eligible = getEligibleAgents(evaluated)
      if (eligible.length === 0) return null
      if (!currentAgentId) return eligible[0]

      const sorted = [...evaluated].sort((a, b) => a.sort_order - b.sort_order)
      const currentIndex = sorted.findIndex((a) => a.id === currentAgentId)

      // Look forward from the current position for the next eligible
      for (let i = 1; i <= sorted.length; i++) {
        const candidate = sorted[(currentIndex + i) % sorted.length]
        if (candidate.status === 'idle') {
          return candidate
        }
      }

      return null
    },
    [evaluateRules, getEligibleAgents],
  )

  // Assign ticket to current "Next Up" agent
  const assignTicket = useCallback(async () => {
    if (!rotation?.next_up_agent_id) {
      toast.error('No agent in rotation')
      return
    }

    const currentAgent = agents.find((a) => a.id === rotation.next_up_agent_id)
    if (!currentAgent) {
      toast.error('Agent not found')
      return
    }

    if (currentAgent.status !== 'idle') {
      toast.error(`${currentAgent.name} is not available (${currentAgent.status})`)
      return
    }

    await supabase.from('ticket_log').insert({
      agent_id: currentAgent.id,
      agent_name: currentAgent.name,
      action: 'Salesforce ticket assigned',
    })

    const nextAgent = findNextEligible(agents, currentAgent.id)
    if (nextAgent) {
      await supabase
        .from('rotation_state')
        .update({
          next_up_agent_id: nextAgent.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1)
    }

    toast.success(`Ticket assigned to ${currentAgent.name}`)
  }, [agents, rotation, supabase, findNextEligible])

  // Direct call - skip the agent without assigning a Salesforce ticket
  const directCall = useCallback(async () => {
    if (!rotation?.next_up_agent_id) {
      toast.error('No agent in rotation')
      return
    }

    const currentAgent = agents.find((a) => a.id === rotation.next_up_agent_id)
    if (!currentAgent) {
      toast.error('Agent not found')
      return
    }

    await supabase.from('ticket_log').insert({
      agent_id: currentAgent.id,
      agent_name: currentAgent.name,
      action: 'Skipped - Direct phone call (Genesys)',
    })

    const nextAgent = findNextEligible(agents, currentAgent.id)
    if (nextAgent) {
      await supabase
        .from('rotation_state')
        .update({
          next_up_agent_id: nextAgent.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1)
    }

    toast.info(`${currentAgent.name} skipped (direct call)`)
  }, [agents, rotation, supabase, findNextEligible])

  // Update agent status
  const updateAgentStatus = useCallback(
    async (agentId: string, status: string) => {
      // Handle DNA toggle
      if (status === 'do-not-assign') {
        await supabase
          .from('agents')
          .update({ is_do_not_assign: true, updated_at: new Date().toISOString() })
          .eq('id', agentId)
      } else if (status === 'idle' || status === 'meal' || status === 'offline') {
        await supabase
          .from('agents')
          .update({ status, is_do_not_assign: false, updated_at: new Date().toISOString() })
          .eq('id', agentId)
      }
    },
    [supabase],
  )

  // --- CRUD for Agent Management ---

  // Helper: convert "HH:MM" to today's Date
  const timeToToday = useCallback((hhmm: string): Date => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d
  }, [])

  // Add a new agent
  const addAgent = useCallback(
    async (form: AgentFormData) => {
      const shiftStart = timeToToday(form.shift_start)
      const shiftEnd = timeToToday(form.shift_end)
      // If shift_end is earlier than shift_start, assume overnight (next day)
      if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1)

      const mealStart = timeToToday(form.meal_start)
      if (mealStart < shiftStart) mealStart.setDate(mealStart.getDate() + 1)
      const mealEnd = new Date(mealStart.getTime() + 60 * 60 * 1000)

      // Get the max sort_order to append at the end
      const maxOrder =
        agents.length > 0
          ? Math.max(...agents.map((a) => a.sort_order))
          : 0

      const { data, error } = await supabase
        .from('agents')
        .insert({
          name: form.name,
          status: 'idle',
          shift_start: shiftStart.toISOString(),
          shift_end: shiftEnd.toISOString(),
          meal_start: mealStart.toISOString(),
          meal_end: mealEnd.toISOString(),
          sort_order: maxOrder + 1,
        })
        .select()
        .single()

      if (error) {
        console.error('[v0] addAgent error:', JSON.stringify(error))
        toast.error(`Failed to add agent: ${error.message}`)
        return
      }

      // If this is the first agent, initialize rotation_state
      if (agents.length === 0 && data) {
        const { error: rotError } = await supabase
          .from('rotation_state')
          .upsert(
            { id: 1, next_up_agent_id: data.id, updated_at: new Date().toISOString() },
            { onConflict: 'id' },
          )
        if (rotError) {
          console.error('[v0] rotation init error:', JSON.stringify(rotError))
        }
      }

      toast.success(`${form.name} added to rotation`)
    },
    [agents, supabase, timeToToday],
  )

  // Update an existing agent
  const updateAgent = useCallback(
    async (agentId: string, form: AgentFormData) => {
      const shiftStart = timeToToday(form.shift_start)
      const shiftEnd = timeToToday(form.shift_end)
      if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1)

      const mealStart = timeToToday(form.meal_start)
      if (mealStart < shiftStart) mealStart.setDate(mealStart.getDate() + 1)
      const mealEnd = new Date(mealStart.getTime() + 60 * 60 * 1000)

      const { error } = await supabase
        .from('agents')
        .update({
          name: form.name,
          shift_start: shiftStart.toISOString(),
          shift_end: shiftEnd.toISOString(),
          meal_start: mealStart.toISOString(),
          meal_end: mealEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentId)

      if (error) {
        toast.error('Failed to update agent')
        return
      }

      toast.success(`${form.name} updated`)
    },
    [supabase, timeToToday],
  )

  // Remove an agent
  const removeAgent = useCallback(
    async (agentId: string) => {
      const agent = agents.find((a) => a.id === agentId)

      // If this agent is the "Next Up", advance the pointer first
      if (rotation?.next_up_agent_id === agentId) {
        const nextAgent = findNextEligible(
          agents.filter((a) => a.id !== agentId),
          null,
        )
        await supabase
          .from('rotation_state')
          .update({
            next_up_agent_id: nextAgent?.id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', 1)
      }

      await supabase.from('agents').delete().eq('id', agentId)

      toast.success(`${agent?.name ?? 'Agent'} removed`)
    },
    [agents, rotation, supabase, findNextEligible],
  )

  // Update agent meal time
  const updateMealTime = useCallback(
    async (agentId: string, mealStartHHMM: string) => {
      const [h, m] = mealStartHHMM.split(':').map(Number)
      const mealStart = new Date()
      mealStart.setHours(h, m, 0, 0)

      // If meal start is before agent's shift start, move to next day
      const shiftStart = agents.find(a => a.id === agentId)?.shift_start
      if (shiftStart && mealStart < new Date(shiftStart)) {
        mealStart.setDate(mealStart.getDate() + 1)
      }

      const mealEnd = new Date(mealStart.getTime() + 60 * 60 * 1000)

      const { error } = await supabase
        .from('agents')
        .update({
          meal_start: mealStart.toISOString(),
          meal_end: mealEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentId)

      if (error) {
        toast.error('Failed to update meal time')
        return
      }

      toast.success('Meal time updated')
    },
    [agents, supabase],
  )

  // Reorder agents - update sort_order for all agents in batch
  const reorderAgents = useCallback(
    async (reorderedAgents: Agent[]) => {
      // Optimistically update local state
      const withNewOrder = reorderedAgents.map((a, i) => ({
        ...a,
        sort_order: i + 1,
      }))
      setAgents(withNewOrder)

      // Batch update sort_order in DB
      const updates = withNewOrder.map((a) =>
        supabase
          .from('agents')
          .update({ sort_order: a.sort_order, updated_at: new Date().toISOString() })
          .eq('id', a.id),
      )

      await Promise.all(updates)
    },
    [supabase],
  )

  return {
    agents,
    rotation,
    logs,
    loading,
    assignTicket,
    directCall,
    updateAgentStatus,
    updateMealTime,
    findNextEligible,
    addAgent,
    updateAgent,
    removeAgent,
    reorderAgents,
  }
}
