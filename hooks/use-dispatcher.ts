"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { db } from "@/lib/firebase/config";
import {
  collection,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import type {
  Agent,
  AgentFormData,
  RotationState,
  TicketLog,
  AgentTeam,
} from "@/lib/types";
import { toast } from "sonner";

export function useDispatcher() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [rotations, setRotations] = useState<Record<string, RotationState>>({});
  const [logs, setLogs] = useState<TicketLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // 10-minute rule evaluation (includes 5-minute transition logic)
  const evaluateRules = useCallback((agentList: Agent[]) => {
    const now = new Date();
    const tenMin = 10 * 60 * 1000;
    const fiveMin = 5 * 60 * 1000;

    return agentList.map((agent) => {
      const shiftEnd = new Date(agent.shift_end);
      const shiftStart = new Date(agent.shift_start);
      const mealStart = agent.meal_start ? new Date(agent.meal_start) : null;
      const mealEnd = agent.meal_end ? new Date(agent.meal_end) : null;
      const timeToEnd = shiftEnd.getTime() - now.getTime();
      const timeToStart = shiftStart.getTime() - now.getTime();
      const timeToMealStart = mealStart
        ? mealStart.getTime() - now.getTime()
        : null;
      const timeToMealEnd = mealEnd ? mealEnd.getTime() - now.getTime() : null;

      const isWarmupShift = timeToStart > 0 && timeToStart <= tenMin;
      const isWarmupMeal =
        timeToMealEnd !== null && timeToMealEnd > 0 && timeToMealEnd <= tenMin;
      const isPriority = isWarmupShift || isWarmupMeal;

      const isDNA = timeToEnd > 0 && timeToEnd <= tenMin;

      const aboutToStartShift = timeToStart > 0 && timeToStart <= fiveMin;
      const aboutFromMeal =
        timeToMealEnd !== null && timeToMealEnd > 0 && timeToMealEnd <= fiveMin;
      const aboutToMeal =
        timeToMealStart !== null &&
        timeToMealStart > 0 &&
        timeToMealStart <= fiveMin;
      const aboutToEndShift = timeToEnd > 0 && timeToEnd <= fiveMin;

      return {
        ...agent,
        is_priority: isPriority,
        is_do_not_assign: isDNA,
        aboutToMeal,
        aboutFromMeal,
        aboutToStartShift,
        aboutToEndShift,
      } as Agent & {
        aboutToMeal: boolean;
        aboutFromMeal: boolean;
        aboutToStartShift: boolean;
        aboutToEndShift: boolean;
      };
    });
  }, []);

  // Re-evaluate the 10-minute rules every 15 seconds
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setAgents((prev) => evaluateRules(prev));
    }, 15000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [evaluateRules]);

  // Subscribe to Realtime Firebase changes
  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const qAgents = query(collection(db, "agents"));
    const unsubAgents = onSnapshot(qAgents, (snapshot) => {
      const newAgents = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Agent,
      );
      newAgents.sort((a, b) => a.sort_order - b.sort_order);
      setAgents(evaluateRules(newAgents));
      setLoadedCount((prev) => prev + 1);
    });
    unsubs.push(unsubAgents);

    const unsubRotation = onSnapshot(
      collection(db, "rotation_state"),
      (snapshot) => {
        const newRotations: Record<string, RotationState> = {};
        snapshot.docs.forEach((docSnap) => {
          newRotations[docSnap.id] = {
            id: docSnap.id,
            ...docSnap.data(),
          } as RotationState;
        });
        setRotations(newRotations);
        setLoadedCount((prev) => prev + 1);
      },
    );
    unsubs.push(unsubRotation);

    const qLogs = query(
      collection(db, "ticket_log"),
      orderBy("created_at", "desc"),
      limit(50),
    );
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const newLogs = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as TicketLog,
      );
      setLogs(newLogs);
      setLoadedCount((prev) => prev + 1);
    });
    unsubs.push(unsubLogs);

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [evaluateRules]);

  // Mark loading false when initial load is done
  useEffect(() => {
    if (loadedCount >= 3) {
      setLoading(false);
    }
  }, [loadedCount]);

  // Apply rules on initial load
  useEffect(() => {
    if (!loading && agents.length > 0) {
      setAgents((prev) => evaluateRules(prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const getEligibleAgents = useCallback((agentList: Agent[]) => {
    return agentList.filter((a) => a.status === "idle");
  }, []);

  const findNextEligible = useCallback(
    (
      agentList: Agent[],
      team: AgentTeam,
      currentAgentId: string | null,
    ): Agent | null => {
      const teamAgents = agentList.filter((a) => a.team === team);
      const evaluated = evaluateRules(teamAgents);

      const priorityAgents = evaluated.filter(
        (a) => a.is_priority && !a.is_do_not_assign,
      );
      if (priorityAgents.length > 0) return priorityAgents[0];

      const eligible = getEligibleAgents(evaluated);
      if (eligible.length === 0) return null;
      if (!currentAgentId) return eligible[0];

      const sorted = [...evaluated].sort((a, b) => a.sort_order - b.sort_order);
      const currentIndex = sorted.findIndex((a) => a.id === currentAgentId);

      for (let i = 1; i <= sorted.length; i++) {
        const candidate = sorted[(currentIndex + i) % sorted.length];
        if (candidate.status === "idle") {
          return candidate;
        }
      }

      return null;
    },
    [evaluateRules, getEligibleAgents],
  );

  const assignTicket = useCallback(
    async (team: AgentTeam) => {
      const rotation = rotations[team];
      if (!rotation?.next_up_agent_id) {
        toast.error(`No agent in ${team} rotation`);
        return;
      }

      const currentAgent = agents.find(
        (a) => a.id === rotation.next_up_agent_id,
      );
      if (!currentAgent) {
        toast.error("Agent not found");
        return;
      }

      if (currentAgent.status !== "idle") {
        toast.error(
          `${currentAgent.name} is not available (${currentAgent.status})`,
        );
        return;
      }

      try {
        await addDoc(collection(db, "ticket_log"), {
          agent_id: currentAgent.id,
          agent_name: currentAgent.name,
          action: `Salesforce ticket assigned (${team})`,
          created_at: new Date().toISOString(),
        });

        const nextAgent = findNextEligible(agents, team, currentAgent.id);
        if (nextAgent) {
          await updateDoc(doc(db, "rotation_state", team), {
            next_up_agent_id: nextAgent.id,
            updated_at: new Date().toISOString(),
          });
        }

        toast.success(`Ticket assigned to ${currentAgent.name}`);
      } catch (err) {
        toast.error("Error assigning ticket");
        console.error(err);
      }
    },
    [agents, rotations, findNextEligible],
  );

  const directCall = useCallback(
    async (team: AgentTeam) => {
      const rotation = rotations[team];
      if (!rotation?.next_up_agent_id) {
        toast.error(`No agent in ${team} rotation`);
        return;
      }

      const currentAgent = agents.find(
        (a) => a.id === rotation.next_up_agent_id,
      );
      if (!currentAgent) {
        toast.error("Agent not found");
        return;
      }

      try {
        await addDoc(collection(db, "ticket_log"), {
          agent_id: currentAgent.id,
          agent_name: currentAgent.name,
          action: `Skipped - Direct phone call (Genesys) (${team})`,
          created_at: new Date().toISOString(),
        });

        const nextAgent = findNextEligible(agents, team, currentAgent.id);
        if (nextAgent) {
          await updateDoc(doc(db, "rotation_state", team), {
            next_up_agent_id: nextAgent.id,
            updated_at: new Date().toISOString(),
          });
        }

        toast.info(`${currentAgent.name} skipped (direct call)`);
      } catch (err) {
        toast.error("Error logging direct call");
        console.error(err);
      }
    },
    [agents, rotations, findNextEligible],
  );

  const updateAgentStatus = useCallback(
    async (agentId: string, status: string) => {
      try {
        if (status === "do-not-assign") {
          await updateDoc(doc(db, "agents", agentId), {
            is_do_not_assign: true,
            updated_at: new Date().toISOString(),
          });
        } else if (
          status === "idle" ||
          status === "meal" ||
          status === "offline"
        ) {
          await updateDoc(doc(db, "agents", agentId), {
            status,
            is_do_not_assign: false,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        toast.error("Failed to update agent status");
        console.error(err);
      }
    },
    [],
  );

  const timeToToday = useCallback((hhmm: string): Date => {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }, []);

  const addAgent = useCallback(
    async (form: AgentFormData) => {
      const shiftStart = timeToToday(form.shift_start);
      const shiftEnd = timeToToday(form.shift_end);
      if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

      const mealStart = timeToToday(form.meal_start);
      if (mealStart < shiftStart) mealStart.setDate(mealStart.getDate() + 1);
      const mealEnd = new Date(mealStart.getTime() + 60 * 60 * 1000);

      const teamAgents = agents.filter((a) => a.team === form.team);
      const maxOrder =
        teamAgents.length > 0
          ? Math.max(...teamAgents.map((a) => a.sort_order))
          : 0;

      try {
        const docRef = await addDoc(collection(db, "agents"), {
          name: form.name,
          team: form.team || "Beginner",
          status: "idle",
          shift_start: shiftStart.toISOString(),
          shift_end: shiftEnd.toISOString(),
          meal_start: mealStart.toISOString(),
          meal_end: mealEnd.toISOString(),
          sort_order: maxOrder + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (teamAgents.length === 0) {
          await setDoc(
            doc(db, "rotation_state", form.team || "Beginner"),
            {
              next_up_agent_id: docRef.id,
              updated_at: new Date().toISOString(),
            },
            { merge: true },
          );
        }

        toast.success(`${form.name} added to ${form.team} rotation`);
      } catch (error: any) {
        console.error("[v0] addAgent error:", error);
        toast.error(`Failed to add agent: ${error.message}`);
      }
    },
    [agents, timeToToday],
  );

  const updateAgent = useCallback(
    async (agentId: string, form: AgentFormData) => {
      const shiftStart = timeToToday(form.shift_start);
      const shiftEnd = timeToToday(form.shift_end);
      if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

      const mealStart = timeToToday(form.meal_start);
      if (mealStart < shiftStart) mealStart.setDate(mealStart.getDate() + 1);
      const mealEnd = new Date(mealStart.getTime() + 60 * 60 * 1000);

      try {
        await updateDoc(doc(db, "agents", agentId), {
          name: form.name,
          team: form.team || "Beginner",
          shift_start: shiftStart.toISOString(),
          shift_end: shiftEnd.toISOString(),
          meal_start: mealStart.toISOString(),
          meal_end: mealEnd.toISOString(),
          updated_at: new Date().toISOString(),
        });
        toast.success(`${form.name} updated`);
      } catch (error) {
        toast.error("Failed to update agent");
        console.error(error);
      }
    },
    [timeToToday],
  );

  const removeAgent = useCallback(
    async (agentId: string) => {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) return;

      try {
        if (rotations[agent.team]?.next_up_agent_id === agentId) {
          const nextAgent = findNextEligible(
            agents.filter((a) => a.id !== agentId),
            agent.team,
            null,
          );
          await setDoc(
            doc(db, "rotation_state", agent.team),
            {
              next_up_agent_id: nextAgent?.id ?? null,
              updated_at: new Date().toISOString(),
            },
            { merge: true },
          );
        }

        await deleteDoc(doc(db, "agents", agentId));
        toast.success(`${agent.name} removed`);
      } catch (error) {
        toast.error("Failed to remove agent");
        console.error(error);
      }
    },
    [agents, rotations, findNextEligible],
  );

  const updateMealTime = useCallback(
    async (agentId: string, mealStartHHMM: string) => {
      const [h, m] = mealStartHHMM.split(":").map(Number);
      const mealStart = new Date();
      mealStart.setHours(h, m, 0, 0);

      const shiftStartStr = agents.find((a) => a.id === agentId)?.shift_start;
      if (shiftStartStr && mealStart < new Date(shiftStartStr)) {
        mealStart.setDate(mealStart.getDate() + 1);
      }

      const mealEnd = new Date(mealStart.getTime() + 60 * 60 * 1000);

      try {
        await updateDoc(doc(db, "agents", agentId), {
          meal_start: mealStart.toISOString(),
          meal_end: mealEnd.toISOString(),
          updated_at: new Date().toISOString(),
        });
        toast.success("Meal time updated");
      } catch (error) {
        toast.error("Failed to update meal time");
        console.error(error);
      }
    },
    [agents],
  );

  const reorderAgents = useCallback(async (reorderedAgents: Agent[]) => {
    try {
      const batch = writeBatch(db);
      reorderedAgents.forEach((a, i) => {
        batch.update(doc(db, "agents", a.id), {
          team: a.team,
          sort_order: i + 1,
          updated_at: new Date().toISOString(),
        });
      });
      await batch.commit();
    } catch (error) {
      toast.error("Failed to reorder agents.");
      console.error(error);
    }
  }, []);

  const setNextUpAgent = useCallback(async (agent: Agent) => {
    try {
      await setDoc(
        doc(db, "rotation_state", agent.team),
        {
          next_up_agent_id: agent.id,
          updated_at: new Date().toISOString(),
        },
        { merge: true },
      );
      toast.success(`${agent.name} set as next up`);
    } catch (err) {
      toast.error("Failed to update next up agent");
      console.error(err);
    }
  }, []);

  const resetActivityLogs = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "ticket_log"));
      const batch = writeBatch(db);
      querySnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      toast.success("Activity log reset successfully");
    } catch (err) {
      toast.error("Failed to reset activity log");
      console.error(err);
    }
  }, []);

  return {
    agents,
    rotations,
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
    resetActivityLogs,
    setNextUpAgent,
  };
}
