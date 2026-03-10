"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, LockKeyhole, Unlock } from "lucide-react";
import { useSession } from "next-auth/react";

import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

type DashboardNodeStepViewerProps = {
  props?: Record<string, unknown>;
};

type StepAsset = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  url: string;
  targetUrl?: string | null;
  openInNewTab?: boolean | null;
  interactionMode: string;
  isDownloadable: boolean;
};

type StepQuestionnaire = {
  prompt: string;
  options: Array<{
    id: string;
    label: string;
  }>;
  correctOptionId?: string;
  successMessage?: string;
} | null;

type CourseViewerStep = {
  id: string;
  title: string;
  description?: string | null;
  isRequired: boolean;
  lockUntilComplete: boolean;
  isUnlocked: boolean;
  isCompleted: boolean;
  blockedByStepId?: string | null;
  content: string;
  coverImageUrl: string;
  questionnaire: StepQuestionnaire;
  assets: StepAsset[];
};

function readProductId(props?: Record<string, unknown>) {
  return typeof props?.productId === "string" ? props.productId : "";
}

function readNodeTitle(props?: Record<string, unknown>) {
  return typeof props?.title === "string" && props.title.trim()
    ? props.title.trim()
    : "Course steps";
}

function openStepAsset(asset: StepAsset) {
  const href =
    asset.type === "LINK"
      ? asset.targetUrl?.trim() || asset.url.trim()
      : asset.url.trim();
  if (!href) return;

  if (asset.openInNewTab ?? asset.type === "LINK") {
    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }

  window.location.href = href;
}

function StepStatusNode({
  isCompleted,
  isCurrent,
  isLocked,
}: {
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked: boolean;
}) {
  const className = isCompleted
    ? "border-emerald-400/70 bg-emerald-500/25 text-emerald-200"
    : isCurrent
      ? "border-white/80 bg-black text-white"
      : isLocked
        ? "border-zinc-900 bg-zinc-900 text-zinc-500"
        : "border-white/30 bg-zinc-950 text-zinc-300";

  return (
    <div
      className={`flex h-10 w-10 rotate-45 items-center justify-center rounded-[10px] border ${className}`}
    >
      <div className="-rotate-45">
        {isCompleted ? (
          <Check className="h-4 w-4" />
        ) : isLocked ? (
          <LockKeyhole className="h-4 w-4" />
        ) : (
          <Unlock className="h-4 w-4" />
        )}
      </div>
    </div>
  );
}

export function DashboardNodeStepViewer({ props }: DashboardNodeStepViewerProps) {
  const { status: sessionStatus } = useSession();
  const utils = api.useUtils();
  const productId = readProductId(props);
  const nodeTitle = readNodeTitle(props);
  const [expandedStepId, setExpandedStepId] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [feedbackByStepId, setFeedbackByStepId] = useState<Record<string, string>>({});

  const viewerQuery = api.products.courseViewerByProductId.useQuery(
    { productId },
    { enabled: Boolean(productId) },
  );
  const completeStepMutation = api.progress.completeStep.useMutation({
    onSuccess: async () => {
      await utils.products.courseViewerByProductId.invalidate({ productId });
    },
    onError: (error) => {
      setFeedbackByStepId((current) => ({
        ...current,
        [expandedStepId]: error.message,
      }));
    },
  });
  const questionnaireMutation = api.progress.submitStepQuestionnaire.useMutation({
    onSuccess: async (result, variables) => {
      setFeedbackByStepId((current) => ({
        ...current,
        [variables.stepId]: result.successMessage,
      }));
      await utils.products.courseViewerByProductId.invalidate({ productId });
    },
    onError: (error, variables) => {
      setFeedbackByStepId((current) => ({
        ...current,
        [variables.stepId]: error.message,
      }));
    },
  });

  const steps = useMemo(
    () => (viewerQuery.data?.steps ?? []) as CourseViewerStep[],
    [viewerQuery.data?.steps],
  );
  const currentStepId = useMemo(
    () => steps.find((step) => step.isUnlocked && !step.isCompleted)?.id ?? steps[0]?.id ?? "",
    [steps],
  );
  const activeExpandedStepId =
    expandedStepId && steps.some((step) => step.id === expandedStepId)
      ? expandedStepId
      : currentStepId;

  if (!productId) {
    return (
      <div className="flex h-full flex-col justify-between rounded-[28px] border border-amber-300/30 bg-amber-500/10 p-5 text-sm text-amber-100">
        <div>
          <p className="font-semibold">`step-viewer` requires a product.</p>
          <p className="mt-2 text-xs text-amber-50/80">
            Attach a `productId` in the page editor so this node can render the step flow.
          </p>
        </div>
      </div>
    );
  }

  if (viewerQuery.isLoading) {
    return (
      <div className="h-full rounded-[28px] border border-white/10 bg-black/40 p-5 text-sm text-zinc-300">
        Loading course steps...
      </div>
    );
  }

  if (!viewerQuery.data) {
    return (
      <div className="h-full rounded-[28px] border border-red-400/40 bg-red-500/10 p-5 text-sm text-red-100">
        Product not found.
      </div>
    );
  }

  return (
    <section className="h-full rounded-[32px] border border-white/15 bg-[#050608] p-4 text-white sm:p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{nodeTitle}</p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            {viewerQuery.data.product.name}
          </h3>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
          {steps.filter((step) => step.isCompleted).length}/{steps.length} done
        </div>
      </div>

      <div className="relative pl-12">
        <div className="absolute left-[18px] top-4 bottom-4 w-px bg-white/20" />
        <div className="space-y-6">
          {steps.map((step) => {
            const isExpanded = activeExpandedStepId === step.id;
            const isCurrent = currentStepId === step.id;
            const isLocked = !step.isUnlocked;
            const hasQuestionnaire = Boolean(step.questionnaire);
            const selectedAnswer = selectedAnswers[step.id] ?? "";
            const feedback = feedbackByStepId[step.id];
            const isStepBusy =
              completeStepMutation.isPending || questionnaireMutation.isPending;

            return (
              <article key={step.id} className="relative">
                <div className="absolute -left-12 top-6">
                  <StepStatusNode
                    isCompleted={step.isCompleted}
                    isCurrent={isCurrent}
                    isLocked={isLocked}
                  />
                </div>

                <div className="overflow-hidden rounded-[24px] border border-white/15 bg-black">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6"
                    onClick={() =>
                      setExpandedStepId((current) =>
                        (current || currentStepId) === step.id ? "" : step.id,
                      )
                    }
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                        <span>{step.isCompleted ? "Completed" : isCurrent ? "Current" : "Step"}</span>
                        {isLocked ? <span className="text-amber-300">Locked</span> : null}
                      </div>
                      <h4 className="mt-2 truncate text-lg font-medium text-white">
                        {step.title}
                      </h4>
                      {step.description ? (
                        <p className="mt-2 max-w-2xl text-sm text-zinc-400">{step.description}</p>
                      ) : null}
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-white/10 px-5 py-5 sm:px-6">
                      {isLocked ? (
                        <div className="rounded-[20px] border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                          Complete the previous required step to unlock this content.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {step.coverImageUrl ? (
                            <div
                              className="h-40 rounded-[22px] border border-white/10 bg-cover bg-center"
                              style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.55)), url(${step.coverImageUrl})` }}
                            />
                          ) : null}

                          {step.content ? (
                            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-zinc-200 whitespace-pre-wrap">
                              {step.content}
                            </div>
                          ) : null}

                          {step.assets.length ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              {step.assets.map((asset) => (
                                <button
                                  key={asset.id}
                                  type="button"
                                  onClick={() => openStepAsset(asset)}
                                  className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-emerald-400/40 hover:bg-emerald-500/5"
                                >
                                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                                    {asset.type}
                                  </p>
                                  <p className="mt-2 text-sm font-medium text-white">{asset.title}</p>
                                  {asset.description ? (
                                    <p className="mt-2 text-xs text-zinc-400">{asset.description}</p>
                                  ) : null}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {hasQuestionnaire && !step.isCompleted ? (
                            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                Completion question
                              </p>
                              <p className="mt-3 text-sm font-medium text-white">
                                {step.questionnaire?.prompt}
                              </p>
                              <div className="mt-4 space-y-2">
                                {step.questionnaire?.options.map((option) => (
                                  <label
                                    key={option.id}
                                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
                                      selectedAnswer === option.id
                                        ? "border-emerald-400/40 bg-emerald-500/10 text-white"
                                        : "border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`step-question-${step.id}`}
                                      checked={selectedAnswer === option.id}
                                      onChange={() =>
                                        setSelectedAnswers((current) => ({
                                          ...current,
                                          [step.id]: option.id,
                                        }))
                                      }
                                    />
                                    <span>{option.label}</span>
                                  </label>
                                ))}
                              </div>
                              <Button
                                className="mt-4 h-11 rounded-xl border-emerald-500/30 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                                disabled={!selectedAnswer || isStepBusy}
                                onClick={() =>
                                  questionnaireMutation.mutate({
                                    productId,
                                    stepId: step.id,
                                    answerId: selectedAnswer,
                                  })
                                }
                              >
                                Submit answer
                              </Button>
                            </div>
                          ) : null}

                          {!hasQuestionnaire && !step.isCompleted ? (
                            <Button
                              className="h-11 rounded-xl border-emerald-500/30 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                              disabled={isStepBusy || sessionStatus !== "authenticated"}
                              onClick={() => completeStepMutation.mutate({ productId, stepId: step.id })}
                            >
                              Mark step complete
                            </Button>
                          ) : null}

                          {step.isCompleted ? (
                            <div className="rounded-[18px] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                              {step.questionnaire?.successMessage ?? "Step completed and next unlocks are available."}
                            </div>
                          ) : null}

                          {sessionStatus !== "authenticated" ? (
                            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-zinc-400">
                              Sign in to save progress and unlock the next steps.
                            </div>
                          ) : null}

                          {feedback ? (
                            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
                              {feedback}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
