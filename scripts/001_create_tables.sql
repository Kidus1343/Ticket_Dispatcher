-- Create agents table
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline',
  shift_start TIMESTAMPTZ NOT NULL,
  shift_end TIMESTAMPTZ NOT NULL,
  meal_end TIMESTAMPTZ,
  is_priority BOOLEAN NOT NULL DEFAULT false,
  is_do_not_assign BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rotation_state table (singleton row for the current pointer)
CREATE TABLE IF NOT EXISTS public.rotation_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  next_up_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ticket_log table
CREATE TABLE IF NOT EXISTS public.ticket_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Disable RLS for this internal dispatcher tool
ALTER TABLE public.agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotation_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_log DISABLE ROW LEVEL SECURITY;
