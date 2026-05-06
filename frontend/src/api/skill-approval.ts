import { get, post } from "./request";
import type { DataResponse, SkillApproval, SkillUsageRecord } from "@/types";

export async function getPendingApprovals(): Promise<SkillApproval[]> {
  const response = await get<DataResponse<SkillApproval[]>>(
    "/api/v1/skills/approvals/pending",
  );
  return response.data;
}

export async function approveSkill(approvalId: string): Promise<void> {
  await post(`/api/v1/skills/approvals/${approvalId}/approve`);
}

export async function rejectSkill(approvalId: string): Promise<void> {
  await post(`/api/v1/skills/approvals/${approvalId}/reject`);
}

export async function getSkillUsage(
  skillId: string,
): Promise<SkillUsageRecord> {
  const response = await get<DataResponse<SkillUsageRecord>>(
    `/api/v1/skills/${skillId}/usage`,
  );
  return response.data;
}

export async function getApprovalHistory(
  skillName: string,
): Promise<SkillApproval[]> {
  const response = await get<DataResponse<SkillApproval[]>>(
    `/api/v1/skills/approvals/${skillName}/history`,
  );
  return response.data;
}
