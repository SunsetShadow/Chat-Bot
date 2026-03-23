import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import vueTsEslintConfig from "@vue/eslint-config-typescript";
import prettierConfig from "@vue/eslint-config-prettier";

export default [
  {
    name: "app/files-to-lint",
    files: ["**/*.{ts,mts,tsx,vue}"],
  },

  {
    name: "app/ignore-files",
    ignores: [
      "**/dist/**",
      "**/dist-ssr/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/.vscode/**",
    ],
  },

  js.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  ...vueTsEslintConfig(),

  {
    name: "app/rules",
    rules: {
      // Vue 规则
      "vue/multi-word-component-names": "off",
      "vue/no-unused-vars": "error",

      // TypeScript 规则
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // JS 规则
      "no-console": "warn",
      "no-debugger": "warn",
    },
  },

  // Prettier 兼容（禁用与 Prettier 冲突的规则）
  prettierConfig,
];
