import { defineConfig } from "wxt";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    resolve: {
      alias: {
        "@": resolve(__dirname, "."),
      },
    },
  }),
  manifest: {
    name: "Ariadne - AI Browser Bridge",
    description:
      "Connects remote AI agents to your local browser. Human-in-the-Control.",
    version: "0.1.0",
    permissions: [
      "tabs",
      "tabGroups",
      "scripting",
      "activeTab",
      "storage",
      "alarms",
    ],
    host_permissions: ["<all_urls>"],
  },
});
