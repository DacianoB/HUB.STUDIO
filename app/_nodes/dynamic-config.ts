import rawComponentsConfig from "./components.json";
import {
  DynamicComponentsConfigSchema,
  parseWithFallback,
} from "./schemas";

const parsedComponents = parseWithFallback(
  DynamicComponentsConfigSchema,
  rawComponentsConfig,
  {},
  "components.json",
);

for (const warning of parsedComponents.warnings) {
  console.warn(warning);
}

export const dynamicComponentsConfig = parsedComponents.value;
