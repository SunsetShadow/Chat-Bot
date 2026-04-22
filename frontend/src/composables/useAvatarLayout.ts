import { ref, watch } from "vue";
import type { AvatarLayoutMode } from "@/types/avatar";

const STORAGE_KEY = "avatar:layout";
const VISIBLE_KEY = "avatar:visible";
const VALID_MODES: AvatarLayoutMode[] = ["float", "side", "fullscreen"];

const stored = localStorage.getItem(STORAGE_KEY);
const layoutMode = ref<AvatarLayoutMode>(
  VALID_MODES.includes(stored as AvatarLayoutMode)
    ? (stored as AvatarLayoutMode)
    : "float",
);
const avatarVisible = ref<boolean>(
  localStorage.getItem(VISIBLE_KEY) !== "false",
);

// 同步到 localStorage
watch(layoutMode, (v) => localStorage.setItem(STORAGE_KEY, v));
watch(avatarVisible, (v) => localStorage.setItem(VISIBLE_KEY, String(v)));

export function useAvatarLayout() {
  function setLayout(mode: AvatarLayoutMode) {
    layoutMode.value = mode;
  }

  function toggleVisible() {
    avatarVisible.value = !avatarVisible.value;
  }

  function setVisible(v: boolean) {
    avatarVisible.value = v;
  }

  return {
    layoutMode,
    avatarVisible,
    setLayout,
    toggleVisible,
    setVisible,
  };
}
