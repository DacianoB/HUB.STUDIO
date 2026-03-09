type DynamicEventLevel = "info" | "warn" | "error";

type DynamicEventPayload = {
  level: DynamicEventLevel;
  event: string;
  slug?: string;
  details?: Record<string, unknown>;
};

export function trackDynamicEvent(payload: DynamicEventPayload) {
  if (typeof window === "undefined") return;
  const detail = {
    ...payload,
    ts: Date.now(),
  };
  window.dispatchEvent(
    new CustomEvent("dynamic-grid:event", {
      detail,
    }),
  );
  if (payload.level === "error") {
    console.error("[dynamic]", payload.event, payload.details ?? {});
    return;
  }
  if (payload.level === "warn") {
    console.warn("[dynamic]", payload.event, payload.details ?? {});
    return;
  }
  console.info("[dynamic]", payload.event, payload.details ?? {});
}
