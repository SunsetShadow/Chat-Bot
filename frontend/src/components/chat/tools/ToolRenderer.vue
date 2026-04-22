<script setup lang="ts">
import { computed, defineComponent } from "vue";
import ToolCallBlock from "../ToolCallBlock.vue";
import WebSearchCard from "./WebSearchCard.vue";
import MailCard from "./MailCard.vue";
import CommandCard from "./CommandCard.vue";
import CronJobCard from "./CronJobCard.vue";
import MemoryCard from "./MemoryCard.vue";
import KnowledgeCard from "./KnowledgeCard.vue";

type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

const RICH_TOOLS: Record<string, ReturnType<typeof defineComponent>> = {
  web_search: WebSearchCard,
  send_mail: MailCard,
  execute_command: CommandCard,
  cron_job: CronJobCard,
  extract_memory: MemoryCard,
  knowledge_query: KnowledgeCard,
};

const props = defineProps<{
  toolName: string;
  state: ToolState;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}>();

const RichComponent = computed(() => RICH_TOOLS[props.toolName]);
</script>

<template>
  <component
    :is="RichComponent"
    v-if="RichComponent"
    :toolName="toolName"
    :state="state"
    :input="input"
    :output="output"
    :errorText="errorText"
    class="my-2"
  />
  <ToolCallBlock
    v-else
    :toolName="toolName"
    :state="state"
    :input="input"
    :output="output"
    :errorText="errorText"
    class="my-2"
  />
</template>
