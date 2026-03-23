<script setup lang="ts">
import { onMounted } from "vue";
import ChatContainer from "@/components/chat/ChatContainer.vue";
import { useAgentStore } from "@/stores/agent";
import { useRulesStore } from "@/stores/rules";

const agentStore = useAgentStore();
const rulesStore = useRulesStore();

onMounted(() => {
  agentStore.fetchAgents();
  rulesStore.fetchRules();
});
</script>

<template>
  <div class="chat-view">
    <ChatContainer />
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
}
</style>
