import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "app/_nodes/node-*/**",
    "app/_nodes/templates/**",
    "app/_nodes/pipeline/**",
    "app/_nodes/lib/**",
    "app/_nodes/route-data/**",
    "app/_nodes/product-card.tsx",
    "app/_nodes/signin.tsx",
    "app/_nodes/instagram.tsx",
    "app/_nodes/components.ts",
    "app/_nodes/dynamic-config.ts",
    "app/_nodes/observability.ts",
    "app/_nodes/dynamic-grid copy.tsx",
  ]),
]);
