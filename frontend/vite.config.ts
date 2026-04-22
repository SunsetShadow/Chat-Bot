import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      basicSsl(),
      vue(),
      tailwindcss(),
      AutoImport({
        imports: [
          "vue",
          "vue-router",
          "pinia",
          {
            "naive-ui": [
              "useDialog",
              "useMessage",
              "useNotification",
              "useLoadingBar",
            ],
          },
        ],
        dts: "src/auto-imports.d.ts",
      }),
      Components({
        resolvers: [NaiveUiResolver()],
        dts: "src/components.d.ts",
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "pixi-live2d-display/dist/cubism4": fileURLToPath(
          new URL("./node_modules/pixi-live2d-display/dist/cubism4.es.js", import.meta.url)
        ),
      },
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://localhost:8000",
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
