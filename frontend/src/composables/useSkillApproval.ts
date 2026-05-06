import { ref } from "vue";
import {
  getPendingApprovals,
  approveSkill,
  rejectSkill,
} from "@/api/skill-approval";
import type { SkillApproval } from "@/types";

const pendingApprovals = ref<SkillApproval[]>([]);
let loaded = false;

export function useSkillApproval() {
  async function loadApprovals() {
    try {
      pendingApprovals.value = await getPendingApprovals();
      loaded = true;
    } catch {
      pendingApprovals.value = [];
    }
  }

  if (!loaded) loadApprovals();

  async function approve(id: string) {
    await approveSkill(id);
    pendingApprovals.value = pendingApprovals.value.filter(
      (a) => a.id !== id,
    );
  }

  async function reject(id: string) {
    await rejectSkill(id);
    pendingApprovals.value = pendingApprovals.value.filter(
      (a) => a.id !== id,
    );
  }

  function notifyFromSSE() {
    loadApprovals();
  }

  return {
    pendingApprovals,
    loadApprovals,
    approve,
    reject,
    notifyFromSSE,
  };
}
