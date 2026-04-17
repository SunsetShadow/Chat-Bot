<script setup lang="ts">
import { useNotification } from "naive-ui";
import { watch } from "vue";
import { useNotificationStore } from "@/stores/notification";

const naiveNotification = useNotification();
const store = useNotificationStore();

watch(
  () => store.toastQueue.length,
  (len) => {
    if (len > 0) {
      const toasts = store.consumeToasts();
      for (const t of toasts) {
        naiveNotification.info({
          title: t.title,
          content: t.content,
          duration: 5000,
          keepAliveOnHover: true,
        });
      }
    }
  },
);
</script>

<template />
