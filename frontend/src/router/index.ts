import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Chat",
    component: () => import("@/views/ChatView.vue"),
  },
  {
    path: "/settings",
    name: "Settings",
    component: () => import("@/views/SettingsView.vue"),
  },
  {
    path: "/agentconfig",
    name: "AgentConfig",
    component: () => import("@/views/AgentConfigView.vue"),
  },
  {
    path: "/avatar",
    name: "Avatar",
    component: () => import("@/views/AvatarView.vue"),
  },
  {
    path: "/cron-jobs",
    name: "CronJobs",
    component: () => import("@/views/CronJobsView.vue"),
  },
  {
    path: "/skills",
    name: "Skills",
    component: () => import("@/views/SkillsView.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
