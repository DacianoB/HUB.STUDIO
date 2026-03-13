'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ChevronDown,
  FileArchive,
  FileImage,
  FileText,
  FileVideo,
  RotateCcw,
  Link2,
  LockKeyhole,
  PlayIcon,
  X,
  Unlock
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { createPortal } from 'react-dom';

import { LibraryAssetDetailPanel } from '~/app/library/library-asset-detail';
import HoverPlayCard from '~/components/ui/hover-play-card';
import { Button } from '~/components/ui/button';
import { VideoPlayer } from '~/components/ui/video-player';
import {
  readStepQuestionnaireAttempt,
  type StepQuestionnaire
} from '~/lib/step-questionnaire';
import { api } from '~/trpc/react';

type DashboardNodeStepViewerProps = {
  props?: Record<string, unknown>;
};

type StepAsset = {
  id: string;
  productId: string;
  title: string;
  description?: string | null;
  type: string;
  url: string;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  targetUrl?: string | null;
  openInNewTab?: boolean | null;
  interactionMode: string;
  isDownloadable: boolean;
  metadata?: unknown;
  sourceLibraryAssetId?: string;
};

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
  questionnaire: StepQuestionnaire | null;
  progress?: {
    status: string;
    completedAt?: string | Date | null;
    metadata?: unknown;
  } | null;
  assets: StepAsset[];
};

type TestResult = {
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  passingScore: number;
  message: string;
};

function readProductId(props?: Record<string, unknown>) {
  return typeof props?.productId === 'string' ? props.productId : '';
}

function readNodeTitle(props?: Record<string, unknown>) {
  return typeof props?.title === 'string' && props.title.trim()
    ? props.title.trim()
    : 'Course steps';
}

function readQuestionnaireAttempt(step: CourseViewerStep) {
  if (!step.progress?.metadata || typeof step.progress.metadata !== 'object') {
    return undefined;
  }

  return readStepQuestionnaireAttempt(
    (step.progress.metadata as { questionnaire?: unknown }).questionnaire
  );
}

function readPortalThemeStyle() {
  if (typeof window === 'undefined') {
    return {};
  }

  const themeRoot =
    (document.activeElement instanceof HTMLElement
      ? document.activeElement.closest('[data-tenant-grid]')
      : null) ?? document.querySelector('[data-tenant-grid]');

  if (!(themeRoot instanceof HTMLElement)) {
    return {};
  }

  const computed = window.getComputedStyle(themeRoot);
  return {
    '--tenant-bg-main': computed.getPropertyValue('--tenant-bg-main').trim(),
    '--tenant-bg-secondary': computed
      .getPropertyValue('--tenant-bg-secondary')
      .trim(),
    '--tenant-text-main': computed
      .getPropertyValue('--tenant-text-main')
      .trim(),
    '--tenant-text-secondary': computed
      .getPropertyValue('--tenant-text-secondary')
      .trim(),
    '--tenant-border': computed.getPropertyValue('--tenant-border').trim(),
    '--tenant-accent': computed.getPropertyValue('--tenant-accent').trim(),
    '--tenant-button-primary': computed
      .getPropertyValue('--tenant-button-primary')
      .trim(),
    '--tenant-button-primary-hover': computed
      .getPropertyValue('--tenant-button-primary-hover')
      .trim(),
    '--tenant-button-text': computed
      .getPropertyValue('--tenant-button-text')
      .trim(),
    '--tenant-card-bg': computed.getPropertyValue('--tenant-card-bg').trim(),
    '--tenant-node-radius': computed
      .getPropertyValue('--tenant-node-radius')
      .trim(),
    '--tenant-node-radius-sm': computed
      .getPropertyValue('--tenant-node-radius-sm')
      .trim(),
    '--tenant-node-radius-pill': computed
      .getPropertyValue('--tenant-node-radius-pill')
      .trim()
  } as CSSProperties;
}

function resolveStepAssetHref(asset: StepAsset) {
  return asset.type === 'LINK'
    ? asset.targetUrl?.trim() || asset.url.trim()
    : asset.url.trim();
}

function openStepAsset(asset: StepAsset) {
  const href = resolveStepAssetHref(asset);
  if (!href) return;

  if (asset.openInNewTab ?? asset.type === 'LINK') {
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }

  window.location.href = href;
}

function assetLabel(asset: StepAsset) {
  if (asset.type === 'LINK') return 'Link';
  if (asset.type === 'VIDEO') return 'Video';
  if (asset.type === 'IMAGE') return 'Image';
  if (asset.type === 'PDF') return 'PDF';
  return asset.isDownloadable ? 'Download' : asset.type;
}

function assetPreviewUrl(asset: StepAsset) {
  if (asset.previewUrl) return asset.previewUrl;
  if (asset.thumbnailUrl) return asset.thumbnailUrl;
  if (asset.type === 'IMAGE') return asset.url;
  return null;
}

function assetPreviewStyle(asset: StepAsset): CSSProperties {
  const previewUrl = assetPreviewUrl(asset);

  if (previewUrl) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.78)), url(${previewUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  }

  if (asset.type === 'VIDEO') {
    return {
      background:
        'radial-gradient(circle at top, rgba(56,189,248,0.32), transparent 55%), linear-gradient(180deg, rgba(15,23,42,0.78), rgba(2,6,23,0.98))'
    };
  }

  if (asset.type === 'PDF') {
    return {
      background:
        'radial-gradient(circle at top, rgba(248,113,113,0.28), transparent 55%), linear-gradient(180deg, rgba(15,23,42,0.78), rgba(2,6,23,0.98))'
    };
  }

  if (asset.type === 'LINK') {
    return {
      background:
        'radial-gradient(circle at top, rgba(74,222,128,0.28), transparent 55%), linear-gradient(180deg, rgba(15,23,42,0.78), rgba(2,6,23,0.98))'
    };
  }

  return {
    background:
      'radial-gradient(circle at top, rgba(244,114,182,0.24), transparent 55%), linear-gradient(180deg, rgba(15,23,42,0.78), rgba(2,6,23,0.98))'
  };
}

function StepAssetIcon({ asset }: { asset: StepAsset }) {
  if (asset.type === 'LINK') return <Link2 className="h-4 w-4" />;
  if (asset.type === 'VIDEO') return <FileVideo className="h-4 w-4" />;
  if (asset.type === 'IMAGE') return <FileImage className="h-4 w-4" />;
  if (asset.type === 'PDF') return <FileText className="h-4 w-4" />;
  return asset.isDownloadable ? (
    <FileArchive className="h-4 w-4" />
  ) : (
    <FileText className="h-4 w-4" />
  );
}

function StepAssetModal({
  asset,
  onClose
}: {
  asset: StepAsset;
  onClose: () => void;
}) {
  const href = resolveStepAssetHref(asset);
  const canDownload = asset.type !== 'LINK' && Boolean(asset.url.trim());
  const canOpen = Boolean(href);
  const portalThemeStyle = readPortalThemeStyle();

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed flex items-center justify-center inset-0 z-[9999]"
      style={portalThemeStyle}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border bg-black/35 backdrop-blur-sm"
        style={{
          borderColor: 'var(--tenant-border)',
          color: 'var(--tenant-text-main)'
        }}
        aria-label="Close library item preview"
      >
        <X className="h-5 w-5" />
      </button>
      {asset.sourceLibraryAssetId ? (
        <div className="absolute  flex items-center justify-center p-4 sm:p-6 ">
          <div
            className="relative  w-full max-w-[900px] rounded-[var(--tenant-node-radius)] "
            onClick={(event) => event.stopPropagation()}
          >
            <LibraryAssetDetailPanel
              assetId={asset.sourceLibraryAssetId}
              backHref=""
              pageName="Step attachment"
              inGrid
              onBack={onClose}
              initialAsset={{
                id: asset.sourceLibraryAssetId,
                productId: asset.productId,
                title: asset.title,
                description: asset.description,
                type: asset.type,
                url: asset.url,
                isDownloadable: asset.isDownloadable,
                metadata: asset.metadata,
                previewUrl: asset.previewUrl,
                thumbnailUrl: asset.thumbnailUrl,
                targetUrl: asset.targetUrl,
                openInNewTab: asset.openInNewTab
              }}
            />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
          <div
            className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border "
            style={{
              borderColor: 'var(--tenant-border)',
              backgroundColor: 'var(--tenant-card-bg)'
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border bg-black/35 backdrop-blur-sm"
              style={{
                borderColor: 'var(--tenant-border)',
                color: 'var(--tenant-text-main)'
              }}
              aria-label="Close attachment preview"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1.35fr_0.65fr]">
              <div
                className="flex min-h-[280px] items-center justify-center border-b p-4 lg:min-h-[620px] lg:border-b-0 lg:border-r"
                style={{
                  borderColor: 'var(--tenant-border)',
                  backgroundColor: 'rgba(255,255,255,0.03)'
                }}
              >
                {asset.type === 'VIDEO' ? (
                  <VideoPlayer
                    src={asset.url}
                    poster={assetPreviewUrl(asset) ?? undefined}
                    title={asset.title}
                    className="max-h-full w-full rounded-[20px]"
                    videoClassName="max-h-full w-full object-contain"
                  />
                ) : asset.type === 'IMAGE' ? (
                  <Image
                    src={asset.url}
                    alt={asset.title}
                    width={1600}
                    height={1600}
                    unoptimized
                    className="max-h-full w-full rounded-[20px] object-contain"
                  />
                ) : asset.type === 'PDF' ? (
                  <iframe
                    src={asset.url}
                    title={asset.title}
                    className="h-[70vh] min-w-[600px] w-full rounded-[20px] bg-white"
                  />
                ) : (
                  <div
                    className="flex h-full min-h-[280px] w-full flex-col items-center justify-center rounded-[20px] border p-8 text-center"
                    style={{
                      ...assetPreviewStyle(asset),
                      borderColor: 'var(--tenant-border)',
                      color: 'var(--tenant-text-main)'
                    }}
                  >
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-black/25"
                      style={{ borderColor: 'rgba(255,255,255,0.14)' }}
                    >
                      <StepAssetIcon asset={asset} />
                    </div>
                    <p className="mt-4 text-lg font-semibold">{asset.title}</p>
                    <p
                      className="mt-2 max-w-sm text-sm"
                      style={{ color: 'var(--tenant-text-secondary)' }}
                    >
                      {asset.type === 'LINK'
                        ? 'This attachment opens an external link.'
                        : 'Preview is not available for this file type, but you can download it below.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex min-h-0 flex-col justify-between p-5 sm:p-6">
                <div>
                  <p
                    className="text-[11px] uppercase tracking-[0.22em]"
                    style={{ color: 'var(--tenant-text-secondary)' }}
                  >
                    Step Attachment
                  </p>
                  <h3
                    className="mt-2 text-2xl font-semibold"
                    style={{ color: 'var(--tenant-text-main)' }}
                  >
                    {asset.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className="rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
                      style={{
                        borderColor: 'var(--tenant-border)',
                        color: 'var(--tenant-text-secondary)'
                      }}
                    >
                      {assetLabel(asset)}
                    </span>
                    {asset.isDownloadable ? (
                      <span
                        className="rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
                        style={{
                          borderColor:
                            'color-mix(in srgb, var(--tenant-button-primary) 35%, transparent)',
                          color: 'var(--tenant-button-primary)'
                        }}
                      >
                        Download enabled
                      </span>
                    ) : null}
                  </div>
                  {asset.description ? (
                    <p
                      className="mt-4 text-sm leading-6"
                      style={{ color: 'var(--tenant-text-secondary)' }}
                    >
                      {asset.description}
                    </p>
                  ) : null}
                  <p
                    className="mt-4 break-all text-xs"
                    style={{ color: 'var(--tenant-text-secondary)' }}
                  >
                    {asset.url}
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  {canDownload ? (
                    <a
                      href={asset.url}
                      download
                      className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition"
                      style={{
                        backgroundColor: 'var(--tenant-button-primary)',
                        color: 'var(--tenant-button-text)'
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  ) : null}
                  {canOpen ? (
                    <button
                      type="button"
                      onClick={() => openStepAsset(asset)}
                      className="inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition"
                      style={{
                        borderColor: 'var(--tenant-border)',
                        color: 'var(--tenant-text-main)'
                      }}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {asset.type === 'LINK' ? 'Visit link' : 'Open original'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

function StepTestModal({
  step,
  answers,
  result,
  isPending,
  onAnswerChange,
  onClose,
  onRetry,
  onSubmit
}: {
  step: CourseViewerStep;
  answers: Record<string, string>;
  result: TestResult | null;
  isPending: boolean;
  onAnswerChange: (questionId: string, answerId: string) => void;
  onClose: () => void;
  onRetry: () => void;
  onSubmit: () => void;
}) {
  const portalThemeStyle = readPortalThemeStyle();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const questions = step.questionnaire?.questions ?? [];
  const currentQuestion = questions[currentQuestionIndex] ?? null;
  const answeredCount = questions.filter(
    (question) => answers[question.id]
  ).length;
  const isCurrentQuestionAnswered = currentQuestion
    ? Boolean(answers[currentQuestion.id])
    : false;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (
    typeof document === 'undefined' ||
    !step.questionnaire ||
    !questions.length
  ) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999]" style={portalThemeStyle}>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div
          className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[20px] border"
          style={{
            borderColor: 'var(--tenant-border)',
            backgroundColor: 'var(--tenant-card-bg)'
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className="flex items-center justify-between border-b px-5 py-4"
            style={{ borderColor: 'var(--tenant-border)' }}
          >
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.18em]"
                style={{ color: 'var(--tenant-text-secondary)' }}
              >
                Step test
              </p>
              <h3
                className="mt-1 text-lg font-semibold"
                style={{ color: 'var(--tenant-text-main)' }}
              >
                {step.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
              style={{
                borderColor: 'var(--tenant-border)',
                color: 'var(--tenant-text-main)'
              }}
              aria-label="Close test"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {result ? (
            <div className="flex flex-1 flex-col justify-between gap-6 px-5 py-5 sm:px-6">
              <div className="space-y-4">
                <div
                  className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{
                    borderColor: result.passed
                      ? 'color-mix(in srgb, var(--tenant-button-primary) 35%, transparent)'
                      : 'color-mix(in srgb, #ef4444 45%, transparent)',
                    color: result.passed
                      ? 'var(--tenant-button-primary)'
                      : '#fca5a5'
                  }}
                >
                  {result.passed ? 'Passed' : 'Failed'}
                </div>
                <div>
                  <p
                    className="text-2xl font-semibold"
                    style={{ color: 'var(--tenant-text-main)' }}
                  >
                    {result.message}
                  </p>
                  <p
                    className="mt-2 text-sm leading-6"
                    style={{ color: 'var(--tenant-text-secondary)' }}
                  >
                    Score {result.correctCount} of {result.totalQuestions}. You
                    need {result.passingScore} correct answer
                    {result.passingScore === 1 ? '' : 's'} to pass.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {!result.passed ? (
                  <Button
                    type="button"
                    className="h-11 rounded-xl border px-4 text-sm font-semibold"
                    style={{
                      borderColor: 'var(--tenant-border)',
                      color: 'var(--tenant-text-main)',
                      backgroundColor: 'transparent'
                    }}
                    onClick={() => {
                      setCurrentQuestionIndex(0);
                      onRetry();
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Try again
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="h-11 rounded-xl px-4 text-sm font-semibold"
                  style={{
                    backgroundColor: 'var(--tenant-button-primary)',
                    color: 'var(--tenant-button-text)'
                  }}
                  onClick={onClose}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'var(--tenant-text-main)' }}
                  >
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--tenant-text-secondary)' }}
                  >
                    {answeredCount} of {questions.length} answered
                  </p>
                </div>

                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                      backgroundColor: 'var(--tenant-button-primary)'
                    }}
                  />
                </div>

                {currentQuestion ? (
                  <div className="mt-5">
                    <p
                      className="text-lg font-semibold leading-7"
                      style={{ color: 'var(--tenant-text-main)' }}
                    >
                      {currentQuestion.prompt}
                    </p>
                    <div className="mt-4 space-y-2">
                      {currentQuestion.options.map((option) => (
                        <label
                          key={option.id}
                          className="flex cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-3 text-sm transition"
                          style={{
                            borderColor:
                              answers[currentQuestion.id] === option.id
                                ? 'var(--tenant-button-primary)'
                                : 'var(--tenant-border)',
                            backgroundColor:
                              answers[currentQuestion.id] === option.id
                                ? 'color-mix(in srgb, var(--tenant-button-primary) 12%, transparent)'
                                : 'transparent',
                            color: 'var(--tenant-text-main)'
                          }}
                        >
                          <input
                            type="radio"
                            name={`step-question-${step.id}-${currentQuestion.id}`}
                            checked={answers[currentQuestion.id] === option.id}
                            onChange={() =>
                              onAnswerChange(currentQuestion.id, option.id)
                            }
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div
                className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 sm:px-6"
                style={{ borderColor: 'var(--tenant-border)' }}
              >
                <Button
                  type="button"
                  className="h-11 rounded-xl border px-4 text-sm font-semibold"
                  style={{
                    borderColor: 'var(--tenant-border)',
                    color: 'var(--tenant-text-main)',
                    backgroundColor: 'transparent'
                  }}
                  disabled={currentQuestionIndex === 0}
                  onClick={() =>
                    setCurrentQuestionIndex((current) =>
                      Math.max(0, current - 1)
                    )
                  }
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>

                {isLastQuestion ? (
                  <Button
                    type="button"
                    className="h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--tenant-button-primary)',
                      color: 'var(--tenant-button-text)'
                    }}
                    disabled={answeredCount !== questions.length || isPending}
                    onClick={onSubmit}
                  >
                    {isPending ? 'Checking...' : 'Submit test'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--tenant-button-primary)',
                      color: 'var(--tenant-button-text)'
                    }}
                    disabled={!isCurrentQuestionAnswered}
                    onClick={() =>
                      setCurrentQuestionIndex((current) =>
                        Math.min(questions.length - 1, current + 1)
                      )
                    }
                  >
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function StepStatusNode({
  isCompleted,
  isCurrent,
  isLocked
}: {
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked: boolean;
}) {
  const style: CSSProperties = isCompleted
    ? {
        borderColor: 'var(--complete)', //
        backgroundColor:
          'color-mix(in srgb, var(--complete) 50%, var(--tenant-card-bg))',
        color: 'var(--tenant-text-main)'
      }
    : isCurrent
      ? {
          borderColor: 'var(--tenant-button-primary)',
          backgroundColor:
            'color-mix(in srgb, var(--tenant-button-primary) 50%, var(--tenant-card-bg))',
          color: 'var(--tenant-text-main)'
        }
      : isLocked
        ? {
            borderColor: 'var(--tenant-border)',
            backgroundColor: 'var(--tenant-card-bg)',
            color: 'var(--tenant-text-secondary)'
          }
        : {
            borderColor: 'var(--tenant-border)',
            backgroundColor: 'transparent',
            color: 'var(--tenant-text-main)'
          };

  return (
    <div
      className="flex h-11 w-11 items-center justify-center rounded-full border"
      style={style}
    >
      {isCompleted ? (
        <Check className="h-5 w-5" />
      ) : isLocked ? (
        <LockKeyhole className="h-5 w-5" />
      ) : (
        <PlayIcon className="h-5 w-5" />
      )}
    </div>
  );
}

export function DashboardNodeStepViewer({
  props
}: DashboardNodeStepViewerProps) {
  const { status: sessionStatus } = useSession();
  const utils = api.useUtils();
  const productId = readProductId(props);
  const nodeTitle = readNodeTitle(props);
  const [expandedStepId, setExpandedStepId] = useState('');
  const [testAnswersByStepId, setTestAnswersByStepId] = useState<
    Record<string, Record<string, string>>
  >({});
  const [testResultsByStepId, setTestResultsByStepId] = useState<
    Record<string, TestResult>
  >({});
  const [activeTestStepId, setActiveTestStepId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [feedbackByStepId, setFeedbackByStepId] = useState<
    Record<string, string>
  >({});

  const viewerQuery = api.products.courseViewerByProductId.useQuery(
    { productId },
    { enabled: Boolean(productId) }
  );
  const completeStepMutation = api.progress.completeStep.useMutation({
    onSuccess: async () => {
      await utils.products.courseViewerByProductId.invalidate({ productId });
    },
    onError: (error) => {
      setFeedbackByStepId((current) => ({
        ...current,
        [expandedStepId]: error.message
      }));
    }
  });
  const questionnaireMutation =
    api.progress.submitStepQuestionnaire.useMutation({
      onSuccess: async (result, variables) => {
        setFeedbackByStepId((current) => ({
          ...current,
          [variables.stepId]: result.successMessage
        }));
        setTestResultsByStepId((current) => ({
          ...current,
          [variables.stepId]: {
            passed: result.passed,
            correctCount: result.correctCount,
            totalQuestions: result.totalQuestions,
            passingScore: result.passingScore,
            message: result.successMessage
          }
        }));
        await utils.products.courseViewerByProductId.invalidate({ productId });
      },
      onError: (error, variables) => {
        setFeedbackByStepId((current) => ({
          ...current,
          [variables.stepId]: error.message
        }));
      }
    });

  const steps = useMemo(
    () => (viewerQuery.data?.steps ?? []) as CourseViewerStep[],
    [viewerQuery.data?.steps]
  );
  const completedSteps = useMemo(
    () => steps.filter((step) => step.isCompleted).length,
    [steps]
  );
  const requiredSteps = useMemo(
    () => steps.filter((step) => step.isRequired).length,
    [steps]
  );
  const currentStepId = useMemo(
    () =>
      steps.find((step) => step.isUnlocked && !step.isCompleted)?.id ??
      steps[0]?.id ??
      '',
    [steps]
  );
  const progressPercent = steps.length
    ? Math.round((completedSteps / steps.length) * 100)
    : 0;
  const activeExpandedStepId =
    expandedStepId && steps.some((step) => step.id === expandedStepId)
      ? expandedStepId
      : currentStepId;
  const selectedAsset = useMemo(
    () =>
      steps
        .flatMap((step) => step.assets)
        .find((asset) => asset.id === selectedAssetId) ?? null,
    [selectedAssetId, steps]
  );
  const activeTestStep = useMemo(
    () => steps.find((step) => step.id === activeTestStepId) ?? null,
    [activeTestStepId, steps]
  );

  function openTest(step: CourseViewerStep) {
    setActiveTestStepId(step.id);
    setTestResultsByStepId((current) => {
      const next = { ...current };
      delete next[step.id];
      return next;
    });
    setFeedbackByStepId((current) => ({
      ...current,
      [step.id]: ''
    }));
  }

  function updateTestAnswer(
    stepId: string,
    questionId: string,
    answerId: string
  ) {
    setTestAnswersByStepId((current) => ({
      ...current,
      [stepId]: {
        ...(current[stepId] ?? {}),
        [questionId]: answerId
      }
    }));
  }

  function retryTest(step: CourseViewerStep) {
    setTestAnswersByStepId((current) => ({
      ...current,
      [step.id]: {}
    }));
    setTestResultsByStepId((current) => {
      const next = { ...current };
      delete next[step.id];
      return next;
    });
  }

  function submitTest(step: CourseViewerStep) {
    const answers = Object.entries(testAnswersByStepId[step.id] ?? {}).map(
      ([questionId, answerId]) => ({
        questionId,
        answerId
      })
    );

    questionnaireMutation.mutate({
      productId,
      stepId: step.id,
      answers
    });
  }

  if (!productId) {
    return (
      <div className="flex h-full flex-col justify-between rounded-[28px] border border-amber-300/30 bg-amber-500/10 p-5 text-sm text-amber-100">
        <div>
          <p className="font-semibold">`step-viewer` requires a product.</p>
          <p className="mt-2 text-xs text-amber-50/80">
            Attach a `productId` in the page editor so this node can render the
            step flow.
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

  if (!steps.length) {
    return (
      <section
        className="h-full rounded-[28px] border p-5 text-white"
        style={{
          borderColor: 'var(--tenant-border)',
          backgroundColor: 'var(--tenant-card-bg)'
        }}
      >
        <p
          className="text-[11px] uppercase tracking-[0.22em]"
          style={{ color: 'var(--tenant-text-secondary)' }}
        >
          {nodeTitle}
        </p>
        <h3
          className="mt-2 text-lg font-semibold"
          style={{ color: 'var(--tenant-text-main)' }}
        >
          {viewerQuery.data.product.name}
        </h3>
        <p
          className="mt-3 max-w-md text-sm leading-6"
          style={{ color: 'var(--tenant-text-secondary)' }}
        >
          This course is ready for a step flow, but no steps have been published
          yet.
        </p>
      </section>
    );
  }

  return (
    <section className="h-full rounded-[var(--tenant-node-radius)]  p-4 text-[var(--tenant-text-main)] sm:p-5">
      <div
        className="flex flex-col gap-4 border-b pb-4"
        style={{ borderColor: 'var(--tenant-border)' }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.22em]"
              style={{ color: 'var(--tenant-text-secondary)' }}
            >
              {nodeTitle}
            </p>
            <h3
              className="mt-2 text-lg font-semibold sm:text-xl"
              style={{ color: 'var(--tenant-text-main)' }}
            >
              {viewerQuery.data.product.name}
            </h3>
          </div>
          <div
            className="flex flex-wrap gap-2 text-sm"
            style={{ color: 'var(--tenant-text-secondary)' }}
          >
            {[
              { label: 'Progress', value: `${progressPercent}%` },
              {
                label: 'Completed',
                value: `${completedSteps}/${steps.length}`
              },
              { label: 'Required', value: `${requiredSteps}` }
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-full border px-3 py-1.5"
                style={{
                  borderColor:
                    stat.label === 'Progress'
                      ? 'var(--tenant-button-primary)'
                      : 'var(--tenant-border)',
                  color:
                    stat.label === 'Progress'
                      ? 'var(--tenant-text-main)'
                      : 'var(--tenant-text-secondary)'
                }}
              >
                <span className="font-medium">{stat.value}</span>{' '}
                {stat.label.toLowerCase()}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: 'var(--tenant-text-secondary)' }}>
              {steps.find((step) => step.id === currentStepId)?.title ??
                'Ready to begin'}
            </span>
            <span style={{ color: 'var(--tenant-text-secondary)' }}>
              {completedSteps} finished
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: 'var(--tenant-button-primary)'
              }}
            />
          </div>
        </div>
      </div>

      <div className="relative mt-4 pl-10">
        <div
          className="absolute bottom-3 left-2 top-3 w-px"
          style={{ backgroundColor: 'var(--tenant-border)' }}
        />
        <div className="space-y-3">
          {steps.map((step, index) => {
            const isExpanded = activeExpandedStepId === step.id;
            const isCurrent = currentStepId === step.id;
            const isLocked = !step.isUnlocked;
            const hasQuestionnaire = Boolean(step.questionnaire);
            const questionnaireAttempt = readQuestionnaireAttempt(step);
            const questionCount = step.questionnaire?.questions.length ?? 0;
            const feedback = feedbackByStepId[step.id];
            const isStepBusy =
              completeStepMutation.isPending || questionnaireMutation.isPending;

            return (
              <article key={step.id} className="relative">
                <div className="absolute -left-8 -translate-x-1/2 top-1">
                  <StepStatusNode
                    isCompleted={step.isCompleted}
                    isCurrent={isCurrent}
                    isLocked={isLocked}
                  />
                </div>

                <div
                  className="absolute inset-0 z-0 overflow-hidden rounded-[var(--tenant-node-radius)] border"
                  style={{
                    borderColor: 'var(--tenant-border)',
                    backgroundColor: 'var(--tenant-card-bg)'
                  }}
                >
                  <div className="absolute inset-0 z-10 bg-gradient-to-r from-[var(--tenant-card-bg)]  to-black/70 h-full w-full"></div>
                  {step.coverImageUrl ? (
                    <div
                      className="absolute inset-0 z-0 h-full w-full bg-cover bg-center"
                      style={{
                        filter: 'blur(2px)',
                        backgroundImage: `url(${step.coverImageUrl})`
                      }}
                    />
                  ) : null}
                </div>

                <div
                  className="overflow-hidden relative z-10 rounded-[var(--tenant-node-radius)]  transition-all"
                  style={{
                    boxShadow: isExpanded
                      ? '4px 4px 0px 0px var(--tenant-button-primary)'
                      : 'none'
                    // borderColor: isExpanded
                    //   ? 'var(--tenant-button-primary)'
                    //   : 'var(--tenant-border)'
                  }}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 py-6 text-left px-8"
                    onClick={() =>
                      setExpandedStepId((current) =>
                        (current || currentStepId) === step.id ? '' : step.id
                      )
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em]"
                        style={{ color: 'var(--tenant-text-secondary)' }}
                      >
                        <span>Step {index + 1}</span>

                        {step.isRequired ? (
                          <span
                            className="rounded-full border px-2 py-1 tracking-[0.18em] "
                            style={{
                              borderColor: 'var(--tenant-border)',
                              backgroundColor:
                                'color-mix(in srgb, var(--tenant-bg-secondary) 50%, transparent)'
                            }}
                          >
                            Required
                          </span>
                        ) : null}
                        {isLocked ? (
                          <span style={{ color: 'var(--tenant-accent)' }}>
                            Locked
                          </span>
                        ) : null}
                      </div>
                      <h4
                        className="mt-2 truncate text-base font-semibold sm:text-lg"
                        style={{ color: 'var(--tenant-text-main)' }}
                      >
                        {step.title}
                      </h4>
                      {step.description ? (
                        <p
                          className="mt-1 max-w-2xl text-sm leading-6"
                          style={{ color: 'var(--tenant-text-secondary)' }}
                        >
                          {step.description}
                        </p>
                      ) : null}
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--tenant-text-secondary)' }}
                    />
                  </button>

                  {isExpanded ? (
                    <div
                      className="border-t px-8 py-4 bg-[var(--tenant-card-bg)]"
                      style={{ borderColor: 'var(--tenant-border)' }}
                    >
                      {isLocked ? (
                        <div
                          className="text-sm"
                          style={{ color: 'var(--tenant-text-secondary)' }}
                        >
                          Complete the previous required step to unlock this
                          content.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {step.content ? (
                            <div
                              className="text-sm leading-7 whitespace-pre-wrap "
                              style={{ color: 'var(--tenant-text-main)' }}
                            >
                              <p
                                className="mb-2 text-[11px] uppercase tracking-[0.18em]"
                                style={{
                                  color: 'var(--tenant-button-primary)'
                                }}
                              >
                                Content
                              </p>
                              {step.content}
                            </div>
                          ) : null}

                          {step.assets.length ? (
                            <div className="bg-[var(--tenant-bg-secondary)] rounded-[var(--tenant-node-radius)] p-4">
                              <p
                                className="mb-2 text-[11px] uppercase tracking-[0.18em]"
                                style={{
                                  color: 'var(--tenant-button-primary)'
                                }}
                              >
                                Attachments
                              </p>
                              <div className="grid gap-3 sm:grid-cols-3">
                                {step.assets.map((asset) =>
                                  asset.type === 'VIDEO' ? (
                                    <HoverPlayCard
                                      key={asset.id}
                                      src={asset.url}
                                      poster={
                                        assetPreviewUrl(asset) ?? undefined
                                      }
                                      title={asset.title}
                                      className="h-28 rounded-[18px] border-0"
                                      onOpen={() =>
                                        setSelectedAssetId(asset.id)
                                      }
                                    />
                                  ) : (
                                    <button
                                      key={asset.id}
                                      type="button"
                                      onClick={() =>
                                        setSelectedAssetId(asset.id)
                                      }
                                      className="group overflow-hidden rounded-[18px]  text-left transition hover:-translate-y-0.5"
                                      style={{
                                        backgroundColor:
                                          'var(--tenant-bg-secondary)'
                                      }}
                                    >
                                      <div
                                        className="flex h-28 items-end justify-between p-3"
                                        style={assetPreviewStyle(asset)}
                                      >
                                        <div
                                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-black/30 backdrop-blur-sm"
                                          style={{
                                            borderColor: 'var(--tenant-border)',
                                            color:
                                              'var(--tenant-button-primary)'
                                          }}
                                        >
                                          <StepAssetIcon asset={asset} />
                                        </div>
                                        <span
                                          className="rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]"
                                          style={{
                                            borderColor:
                                              'rgba(255,255,255,0.14)',
                                            backgroundColor:
                                              'rgba(2,6,23,0.38)',
                                            color: 'var(--tenant-text-main)'
                                          }}
                                        >
                                          {assetLabel(asset)}
                                        </span>
                                      </div>
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          ) : null}

                          {hasQuestionnaire && !step.isCompleted ? (
                            <div
                              className="border-t pt-4"
                              style={{ borderColor: 'var(--tenant-border)' }}
                            >
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                  <p
                                    className="text-[11px] uppercase tracking-[0.18em]"
                                    style={{
                                      color: 'var(--tenant-text-secondary)'
                                    }}
                                  >
                                    Step test
                                  </p>
                                  <p
                                    className="mt-2 text-sm"
                                    style={{ color: 'var(--tenant-text-main)' }}
                                  >
                                    {questionCount} question
                                    {questionCount === 1 ? '' : 's'} in this
                                    test.
                                  </p>
                                  <p
                                    className="mt-1 text-sm"
                                    style={{
                                      color: 'var(--tenant-text-secondary)'
                                    }}
                                  >
                                    Pass with{' '}
                                    {step.questionnaire?.passingScore ??
                                      questionCount}{' '}
                                    correct answer
                                    {(step.questionnaire?.passingScore ??
                                      questionCount) === 1
                                      ? ''
                                      : 's'}
                                    .
                                  </p>
                                </div>
                                <Button
                                  className="h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                                  style={{
                                    backgroundColor:
                                      'var(--tenant-button-primary)',
                                    color: 'var(--tenant-button-text)'
                                  }}
                                  disabled={
                                    isStepBusy ||
                                    sessionStatus !== 'authenticated'
                                  }
                                  onClick={() => openTest(step)}
                                >
                                  {questionnaireAttempt
                                    ? 'Retake test'
                                    : 'Take test'}
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {step.isCompleted ? (
                            <p
                              className="text-sm"
                              style={{ color: 'var(--tenant-text-secondary)' }}
                            >
                              {step.questionnaire?.successMessage ??
                                'Step completed and the next unlock is available.'}
                            </p>
                          ) : !hasQuestionnaire ? (
                            <div
                              className="border-t pt-4"
                              style={{ borderColor: 'var(--tenant-border)' }}
                            >
                              <Button
                                className="h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                                style={{
                                  backgroundColor:
                                    'var(--tenant-button-primary)',
                                  color: 'var(--tenant-button-text)'
                                }}
                                disabled={
                                  isStepBusy ||
                                  sessionStatus !== 'authenticated'
                                }
                                onClick={() =>
                                  completeStepMutation.mutate({
                                    productId,
                                    stepId: step.id
                                  })
                                }
                              >
                                Mark step complete
                              </Button>
                            </div>
                          ) : null}

                          {!step.isCompleted && hasQuestionnaire ? (
                            <div className="space-y-2">
                              <p
                                className="text-sm leading-6"
                                style={{
                                  color: 'var(--tenant-text-secondary)'
                                }}
                              >
                                Take the test to finish this step and unlock the
                                next one.
                              </p>
                              {questionnaireAttempt ? (
                                <p
                                  className="text-sm"
                                  style={{
                                    color: questionnaireAttempt.passed
                                      ? 'var(--tenant-button-primary)'
                                      : '#fca5a5'
                                  }}
                                >
                                  Last result:{' '}
                                  {questionnaireAttempt.passed
                                    ? 'passed'
                                    : 'failed'}{' '}
                                  ({questionnaireAttempt.correctCount}/
                                  {questionnaireAttempt.totalQuestions})
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {sessionStatus !== 'authenticated' ? (
                            <p
                              className="text-xs"
                              style={{ color: 'var(--tenant-text-secondary)' }}
                            >
                              Sign in to save progress and unlock the next
                              steps.
                            </p>
                          ) : null}

                          {feedback ? (
                            <p
                              className="text-sm"
                              style={{ color: 'var(--tenant-text-main)' }}
                            >
                              {feedback}
                            </p>
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
      {selectedAsset ? (
        <StepAssetModal
          asset={selectedAsset}
          onClose={() => setSelectedAssetId('')}
        />
      ) : null}
      {activeTestStep ? (
        <StepTestModal
          key={activeTestStep.id}
          step={activeTestStep}
          answers={testAnswersByStepId[activeTestStep.id] ?? {}}
          result={testResultsByStepId[activeTestStep.id] ?? null}
          isPending={questionnaireMutation.isPending}
          onAnswerChange={(questionId, answerId) =>
            updateTestAnswer(activeTestStep.id, questionId, answerId)
          }
          onClose={() => setActiveTestStepId('')}
          onRetry={() => retryTest(activeTestStep)}
          onSubmit={() => submitTest(activeTestStep)}
        />
      ) : null}
    </section>
  );
}
