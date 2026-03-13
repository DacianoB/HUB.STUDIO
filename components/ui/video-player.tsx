'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  FolderDown,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Settings,
  SkipForward,
  Volume2,
  VolumeX
} from 'lucide-react';

import { cn } from '~/lib/utils';

const videoPlayerVariants = cva(
  'group relative w-full overflow-hidden bg-[var(--tenant-card-bg)]',
  {
    variants: {
      size: {
        sm: 'max-w-md',
        default: 'max-w-4xl',
        lg: 'max-w-4xl',
        full: 'w-full max-w-none'
      }
    },
    defaultVariants: { size: 'default' }
  }
);

const STORE = {
  volume: 'hub.video-player-volume',
  muted: 'hub.video-player-muted',
  rate: 'hub.video-player-rate'
} as const;

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const DISPLAY_TIME_STEP = 0.16;
const DISPLAY_TIME_INTERVAL = 180;
const VISUAL_PROGRESS_TRANSITION = 140;
type MediaOrientation = 'landscape' | 'portrait' | 'square' | 'unknown';
type ScreenOrientationLock =
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary';

type FrameSyncedVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (
      now: DOMHighResTimeStamp,
      metadata: { mediaTime?: number }
    ) => void
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

type FullscreenCapableVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: ScreenOrientationLock) => Promise<void>;
  unlock?: () => void;
};

function formatTime(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60)
    .toString()
    .padStart(2, '0');

  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

function readNumber(key: string, fallback: number) {
  if (typeof window === 'undefined') return fallback;
  const parsed = Number.parseFloat(window.localStorage.getItem(key) ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(key);
  return stored === null ? fallback : stored === 'true';
}

function writeStorage(key: string, value: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, value);
  }
}

function parseAspectRatio(value?: string) {
  if (!value?.includes('/')) return undefined;
  const [w, h] = value.split('/');
  const width = Number.parseFloat(w ?? '');
  const height = Number.parseFloat(h ?? '');
  return width > 0 && height > 0 ? `${width} / ${height}` : undefined;
}

function getAspectRatioValue(value?: string) {
  if (!value?.includes('/')) return null;
  const [w, h] = value.split('/');
  const width = Number.parseFloat(w ?? '');
  const height = Number.parseFloat(h ?? '');
  return width > 0 && height > 0 ? width / height : null;
}

function getOrientationFromRatio(ratio?: number | null): MediaOrientation {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) {
    return 'unknown';
  }

  if (ratio > 1.02) return 'landscape';
  if (ratio < 0.98) return 'portrait';
  return 'square';
}

function getSizeMaxWidthClass(
  size?: VariantProps<typeof videoPlayerVariants>['size']
) {
  switch (size) {
    case 'sm':
      return 'max-w-md';
    case 'default':
    case 'lg':
      return 'max-w-4xl';
    case 'full':
    default:
      return 'max-w-none';
  }
}

export interface VideoPlayerProps
  extends
    React.VideoHTMLAttributes<HTMLVideoElement>,
    VariantProps<typeof videoPlayerVariants> {
  src: string;
  poster?: string;
  showControls?: boolean;
  autoHide?: boolean;
  className?: string;
  videoClassName?: string;
  material?: string;
  autoplayOnVisible?: boolean;
  introEndTime?: number;
  loopStartTime?: number;
  loopDuration?: number;
  isLoop?: boolean;
  aspectRatio?: string;
}

const VideoPlayer = React.forwardRef<HTMLVideoElement, VideoPlayerProps>(
  (
    {
      className,
      videoClassName,
      size,
      src,
      poster,
      showControls = true,
      autoHide = true,
      loop = false,
      muted: mutedProp,
      autoPlay = false,
      material = '',
      autoplayOnVisible = false,
      introEndTime = 0,
      loopStartTime = 0,
      loopDuration = 0,
      isLoop = false,
      aspectRatio,
      title,
      ...props
    },
    ref
  ) => {
    const [playing, setPlaying] = React.useState(autoPlay);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [volume, setVolume] = React.useState(0.9);
    const [muted, setMuted] = React.useState(Boolean(mutedProp));
    const [rate, setRate] = React.useState(1);
    const [loading, setLoading] = React.useState(true);
    const [fullscreen, setFullscreen] = React.useState(false);
    const [controlsVisible, setControlsVisible] = React.useState(false);
    const [focusedWithin, setFocusedWithin] = React.useState(false);
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const [volumeOpen, setVolumeOpen] = React.useState(false);
    const [isScrubbing, setIsScrubbing] = React.useState(false);
    const [loopingSegment, setLoopingSegment] = React.useState(isLoop);
    const [visible, setVisible] = React.useState(false);
    const [mouseActive, setMouseActive] = React.useState(true);
    const [videoSize, setVideoSize] = React.useState({ width: 0, height: 0 });
    const [viewport, setViewport] = React.useState({
      width: 0,
      height: 0,
      mobile: false
    });
    const fullscreenVideoMaxWidthClass = React.useMemo(
      () => getSizeMaxWidthClass(size),
      [size]
    );
    const videoOrientation = React.useMemo(() => {
      const ratio =
        videoSize.width > 0 && videoSize.height > 0
          ? videoSize.width / videoSize.height
          : getAspectRatioValue(aspectRatio);
      return getOrientationFromRatio(ratio);
    }, [aspectRatio, videoSize.height, videoSize.width]);
    const fullscreenVideoClassName = React.useMemo(() => {
      if (!fullscreen) return 'h-full w-full';

      if (viewport.mobile) {
        if (videoOrientation === 'portrait') {
          return 'absolute inset-0 m-auto h-full w-auto max-w-full object-contain max-md:!object-fit';
        }

        if (videoOrientation === 'landscape') {
          return 'absolute inset-0 m-auto h-auto w-full max-h-full object-contain max-md:!object-fit';
        }
      }

      return `absolute inset-0 m-auto h-auto w-full max-h-full object-contain ${fullscreenVideoMaxWidthClass}`;
    }, [
      fullscreen,
      fullscreenVideoMaxWidthClass,
      videoOrientation,
      viewport.mobile
    ]);

    const videoRef = React.useRef<HTMLVideoElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    const volumeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    const userPausedRef = React.useRef(false);
    const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
    const lastTapRef = React.useRef(0);
    const lastVolumeRef = React.useRef(0.9);
    const rafRef = React.useRef<number | null>(null);
    const frameSyncRef = React.useRef<number | null>(null);
    const isScrubbingRef = React.useRef(false);
    const pendingSeekTimeRef = React.useRef<number | null>(null);
    const currentTimeRef = React.useRef(0);
    const durationRef = React.useRef(0);
    const seekInputRef = React.useRef<HTMLInputElement>(null);
    const progressBarRef = React.useRef<HTMLDivElement>(null);
    const progressFillRef = React.useRef<HTMLDivElement>(null);
    const progressThumbRef = React.useRef<HTMLDivElement>(null);
    const progressTransitionRef = React.useRef<string | null>(null);
    const lastTimeCommitRef = React.useRef({ time: 0, stamp: 0 });
    const orientationLockRef = React.useRef<MediaOrientation | null>(null);
    const loopConfigRef = React.useRef({
      enabled: isLoop,
      start: loopStartTime,
      duration: loopDuration
    });
    const unlockScreenOrientation = React.useCallback(() => {
      if (typeof screen === 'undefined') return;
      const orientation = screen.orientation as
        | LockableScreenOrientation
        | undefined;

      if (typeof orientation?.unlock !== 'function') {
        return;
      }

      try {
        orientation.unlock();
      } catch {}

      orientationLockRef.current = null;
    }, []);

    React.useImperativeHandle(
      ref,
      () => videoRef.current as HTMLVideoElement,
      []
    );

    const setCurrentPlaybackTime = React.useCallback(
      (next: number, options?: { force?: boolean }) => {
        const safe = Number.isFinite(next) ? Math.max(0, next) : 0;
        currentTimeRef.current = safe;

        const now =
          typeof performance !== 'undefined' ? performance.now() : Date.now();
        const shouldCommit =
          options?.force ||
          safe < lastTimeCommitRef.current.time ||
          Math.abs(safe - lastTimeCommitRef.current.time) >=
            DISPLAY_TIME_STEP ||
          now - lastTimeCommitRef.current.stamp >= DISPLAY_TIME_INTERVAL;

        if (!shouldCommit) {
          return;
        }

        lastTimeCommitRef.current = { time: safe, stamp: now };
        setCurrentTime((current) =>
          Math.abs(current - safe) < 0.01 ? current : safe
        );
      },
      []
    );

    const setVideoDuration = React.useCallback((next: number) => {
      const safe = Number.isFinite(next) ? Math.max(0, next) : 0;
      durationRef.current = safe;
      setDuration(safe);
    }, []);

    const syncProgressUi = React.useCallback(
      (
        nextTime: number,
        nextDuration = durationRef.current,
        options?: { instant?: boolean }
      ) => {
        const video = videoRef.current;
        const safeDuration = Number.isFinite(nextDuration)
          ? Math.max(0, nextDuration)
          : 0;
        const safeTime =
          safeDuration > 0
            ? Math.min(Math.max(0, nextTime), safeDuration)
            : Math.max(0, nextTime);
        const isLivePlayback = Boolean(
          video &&
          !video.paused &&
          !video.ended &&
          !video.seeking &&
          !isScrubbingRef.current
        );
        const transitionDuration = options?.instant
          ? '0ms'
          : isLivePlayback
            ? '0ms'
            : `${VISUAL_PROGRESS_TRANSITION}ms`;

        currentTimeRef.current = safeTime;
        if (progressTransitionRef.current !== transitionDuration) {
          progressFillRef.current?.style.setProperty(
            'transition-duration',
            transitionDuration
          );
          progressThumbRef.current?.style.setProperty(
            'transition-duration',
            transitionDuration
          );
          progressTransitionRef.current = transitionDuration;
        }
        progressBarRef.current?.style.setProperty(
          '--video-progress',
          safeDuration > 0 ? String(safeTime / safeDuration) : '0'
        );

        if (seekInputRef.current) {
          seekInputRef.current.max = safeDuration.toString();
          seekInputRef.current.value = safeTime.toString();
        }
      },
      []
    );

    const revealControls = React.useCallback(() => {
      setControlsVisible(true);
      setMouseActive(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (autoHide && playing && !focusedWithin) {
        // setMouseActive(false);
        // setControlsVisible(false);
        hideTimerRef.current = setTimeout(() => {
          setMouseActive(false);
          setControlsVisible(false);
        }, 1500);
      }
    }, [autoHide, focusedWithin, playing]);

    const handleMouseEnter = React.useCallback(() => {
      setMouseActive(true);
      setControlsVisible(true);
    }, []);

    const handleMouseLeave = React.useCallback(() => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setMouseActive(true);
      setControlsVisible(false);
    }, []);

    const applyVolume = React.useCallback((next: number) => {
      const video = videoRef.current;
      if (!video) return;
      const safe = Math.max(0, Math.min(1, next));
      video.volume = safe;
      video.muted = safe === 0;
      setVolume(safe);
      setMuted(safe === 0);
      if (safe > 0) lastVolumeRef.current = safe;
      writeStorage(STORE.volume, safe.toString());
      writeStorage(STORE.muted, String(safe === 0));
    }, []);

    const toggleMute = React.useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      if (video.muted || video.volume === 0) {
        const restored =
          lastVolumeRef.current > 0
            ? lastVolumeRef.current
            : volume > 0
              ? volume
              : 0.9;
        video.muted = false;
        applyVolume(restored);
        return;
      }
      if (video.volume > 0) lastVolumeRef.current = video.volume;
      video.muted = true;
      setMuted(true);
      writeStorage(STORE.muted, 'true');
    }, [applyVolume, volume]);

    const togglePlay = React.useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused || video.ended) {
        userPausedRef.current = false;
        void video.play();
      } else {
        userPausedRef.current = true;
        video.pause();
      }
    }, []);

    const skipBy = React.useCallback(
      (seconds: number) => {
        const video = videoRef.current;
        if (!video) return;
        const next = Math.max(
          0,
          Math.min(durationRef.current, video.currentTime + seconds)
        );
        video.currentTime = next;
        pendingSeekTimeRef.current = next;
        syncProgressUi(next, durationRef.current, { instant: true });
        setCurrentPlaybackTime(next, { force: true });
      },
      [setCurrentPlaybackTime, syncProgressUi]
    );

    const skipIntro = React.useCallback(() => {
      const video = videoRef.current;
      if (!video || !(introEndTime > 0 && introEndTime < durationRef.current)) {
        return;
      }
      video.currentTime = introEndTime;
      pendingSeekTimeRef.current = introEndTime;
      syncProgressUi(introEndTime, durationRef.current, { instant: true });
      setCurrentPlaybackTime(introEndTime, { force: true });
      if (video.paused) void video.play();
    }, [introEndTime, setCurrentPlaybackTime, syncProgressUi]);

    const updateSeekPreview = React.useCallback(
      (next: number) => {
        pendingSeekTimeRef.current = next;
        syncProgressUi(next, durationRef.current, { instant: true });
        setCurrentPlaybackTime(next, { force: true });
      },
      [setCurrentPlaybackTime, syncProgressUi]
    );

    const commitSeek = React.useCallback(
      (next?: number) => {
        const video = videoRef.current;
        if (!video) return;

        const target =
          next ??
          pendingSeekTimeRef.current ??
          currentTimeRef.current ??
          video.currentTime;
        const safeTarget = Math.max(
          0,
          Math.min(durationRef.current || target, target)
        );

        video.currentTime = safeTarget;
        pendingSeekTimeRef.current = safeTarget;
        syncProgressUi(safeTarget, durationRef.current, { instant: true });
        setCurrentPlaybackTime(safeTarget, { force: true });
      },
      [setCurrentPlaybackTime, syncProgressUi]
    );

    React.useEffect(() => {
      isScrubbingRef.current = isScrubbing;
    }, [isScrubbing]);

    React.useEffect(() => {
      loopConfigRef.current = {
        enabled: loopingSegment,
        start: loopStartTime,
        duration: loopDuration
      };
    }, [loopDuration, loopStartTime, loopingSegment]);

    const setPlaybackRate = React.useCallback((next: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = next;
      setRate(next);
      setSettingsOpen(false);
      writeStorage(STORE.rate, next.toString());
    }, []);

    const toggleFullscreen = React.useCallback(async () => {
      const container = containerRef.current;
      const video = videoRef.current as FullscreenCapableVideo | null;
      if (!container) return;

      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
        return;
      }

      try {
        await container.requestFullscreen();
      } catch {
        if (typeof video?.webkitEnterFullscreen === 'function') {
          video.webkitEnterFullscreen();
        }
      }
    }, []);

    React.useEffect(() => {
      const storedVolume = readNumber(STORE.volume, 0.9);
      setVolume(storedVolume);
      setMuted(Boolean(mutedProp) || readBoolean(STORE.muted, false));
      setRate(readNumber(STORE.rate, 1));
      lastVolumeRef.current = storedVolume;
    }, [mutedProp]);

    React.useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = volume;
      video.muted = muted;
      video.playbackRate = rate;
      if (volume > 0) lastVolumeRef.current = volume;
    }, [muted, rate, volume]);

    React.useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      const frameSyncedVideo = video as FrameSyncedVideo;

      const syncProgress = (frameTime?: number) => {
        const {
          enabled,
          start,
          duration: segmentDuration
        } = loopConfigRef.current;
        let nextTime = Number.isFinite(frameTime)
          ? Math.max(0, Number(frameTime))
          : video.currentTime;

        if (
          enabled &&
          segmentDuration > 0 &&
          nextTime >= start + segmentDuration
        ) {
          video.currentTime = start;
          nextTime = start;
        }

        if (!isScrubbingRef.current) {
          const nextDuration =
            durationRef.current ||
            (Number.isFinite(video.duration) ? video.duration : 0);
          syncProgressUi(nextTime, nextDuration, {
            instant: nextTime < currentTimeRef.current
          });
          setCurrentPlaybackTime(nextTime);
        }
      };

      const scheduleSync = () => {
        if (video.paused || video.ended) {
          return;
        }

        if (typeof frameSyncedVideo.requestVideoFrameCallback === 'function') {
          frameSyncRef.current = frameSyncedVideo.requestVideoFrameCallback(
            (_now, metadata) => {
              const nextTime =
                typeof metadata?.mediaTime === 'number'
                  ? metadata.mediaTime
                  : video.currentTime;
              syncProgress(nextTime);
              scheduleSync();
            }
          );
          return;
        }

        rafRef.current = window.requestAnimationFrame(() => {
          syncProgress(video.currentTime);
          scheduleSync();
        });
      };

      const stopSync = () => {
        if (rafRef.current) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (
          frameSyncRef.current !== null &&
          typeof frameSyncedVideo.cancelVideoFrameCallback === 'function'
        ) {
          frameSyncedVideo.cancelVideoFrameCallback(frameSyncRef.current);
          frameSyncRef.current = null;
        }
      };

      const startSync = () => {
        stopSync();
        syncProgress(video.currentTime);
        if (!video.paused && !video.ended) {
          scheduleSync();
        }
      };

      video.addEventListener('play', startSync);
      video.addEventListener('playing', startSync);
      video.addEventListener('pause', stopSync);
      video.addEventListener('ended', stopSync);
      video.addEventListener('seeking', startSync);
      video.addEventListener('seeked', startSync);

      if (!video.paused && !video.ended) {
        startSync();
      }

      return () => {
        stopSync();
        video.removeEventListener('play', startSync);
        video.removeEventListener('playing', startSync);
        video.removeEventListener('pause', stopSync);
        video.removeEventListener('ended', stopSync);
        video.removeEventListener('seeking', startSync);
        video.removeEventListener('seeked', startSync);
      };
    }, [setCurrentPlaybackTime, src, syncProgressUi]);

    React.useEffect(() => {
      if (!isScrubbing) return;

      const stopScrubbing = () => {
        setIsScrubbing(false);
        commitSeek();
      };

      window.addEventListener('pointerup', stopScrubbing);
      window.addEventListener('pointercancel', stopScrubbing);

      return () => {
        window.removeEventListener('pointerup', stopScrubbing);
        window.removeEventListener('pointercancel', stopScrubbing);
      };
    }, [commitSeek, isScrubbing]);

    React.useEffect(() => {
      setLoopingSegment(isLoop);
    }, [isLoop]);

    React.useEffect(() => {
      const onFullscreen = () =>
        setFullscreen(document.fullscreenElement === containerRef.current);
      const video = videoRef.current as FullscreenCapableVideo | null;
      const onNativeFullscreenStart = () => setFullscreen(true);
      const onNativeFullscreenEnd = () => setFullscreen(false);
      const onOutside = (event: MouseEvent) => {
        if (!containerRef.current?.contains(event.target as Node)) {
          setSettingsOpen(false);
        }
      };
      document.addEventListener('fullscreenchange', onFullscreen);
      document.addEventListener('mousedown', onOutside);
      video?.addEventListener('webkitbeginfullscreen', onNativeFullscreenStart);
      video?.addEventListener('webkitendfullscreen', onNativeFullscreenEnd);
      return () => {
        document.removeEventListener('fullscreenchange', onFullscreen);
        document.removeEventListener('mousedown', onOutside);
        video?.removeEventListener(
          'webkitbeginfullscreen',
          onNativeFullscreenStart
        );
        video?.removeEventListener(
          'webkitendfullscreen',
          onNativeFullscreenEnd
        );
      };
    }, []);

    React.useEffect(() => {
      if (!fullscreen) {
        unlockScreenOrientation();
        return;
      }

      if (
        !viewport.mobile ||
        videoOrientation === 'unknown' ||
        videoOrientation === 'square' ||
        typeof screen === 'undefined'
      ) {
        return;
      }

      const orientation = screen.orientation as
        | LockableScreenOrientation
        | undefined;

      if (typeof orientation?.lock !== 'function') {
        return;
      }

      if (orientationLockRef.current === videoOrientation) {
        return;
      }

      void orientation
        .lock(videoOrientation)
        .then(() => {
          orientationLockRef.current = videoOrientation;
        })
        .catch(() => undefined);
    }, [
      fullscreen,
      unlockScreenOrientation,
      videoOrientation,
      viewport.mobile
    ]);

    React.useEffect(
      () => () => unlockScreenOrientation(),
      [unlockScreenOrientation]
    );

    React.useEffect(() => {
      if (!autoplayOnVisible || !containerRef.current) return;
      const observer = new IntersectionObserver(
        ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
        { threshold: 0.5 }
      );
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, [autoplayOnVisible]);

    React.useEffect(() => {
      const video = videoRef.current;
      if (!video || !autoplayOnVisible) return;
      if (visible && !userPausedRef.current) {
        void video.play().catch(() => setPlaying(false));
      } else if (!visible) {
        video.pause();
      }
    }, [autoplayOnVisible, visible]);

    React.useEffect(() => {
      const video = videoRef.current;
      if (!video || !autoPlay) return;
      void video.play().catch(() => setPlaying(false));
    }, [autoPlay, src]);

    React.useEffect(() => {
      setLoading(true);
      pendingSeekTimeRef.current = null;
      lastTimeCommitRef.current = { time: 0, stamp: 0 };
      setVideoSize({ width: 0, height: 0 });
      setCurrentPlaybackTime(0, { force: true });
      setVideoDuration(0);
      syncProgressUi(0, 0, { instant: true });
    }, [setCurrentPlaybackTime, setVideoDuration, src, syncProgressUi]);

    React.useEffect(() => {
      if (typeof window === 'undefined') return;

      const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
      const updateViewport = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const mobile =
          coarsePointerQuery.matches || Math.min(width, height) <= 1024;

        setViewport((current) =>
          current.width === width &&
          current.height === height &&
          current.mobile === mobile
            ? current
            : { width, height, mobile }
        );
      };

      updateViewport();
      window.addEventListener('resize', updateViewport);
      window.addEventListener('orientationchange', updateViewport);

      if (typeof coarsePointerQuery.addEventListener === 'function') {
        coarsePointerQuery.addEventListener('change', updateViewport);
      } else {
        coarsePointerQuery.addListener(updateViewport);
      }

      return () => {
        window.removeEventListener('resize', updateViewport);
        window.removeEventListener('orientationchange', updateViewport);

        if (typeof coarsePointerQuery.removeEventListener === 'function') {
          coarsePointerQuery.removeEventListener('change', updateViewport);
        } else {
          coarsePointerQuery.removeListener(updateViewport);
        }
      };
    }, []);

    React.useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleLoadStart = () => setLoading(true);
      const syncVideoGeometry = () => {
        const width = video.videoWidth || 0;
        const height = video.videoHeight || 0;

        setVideoSize((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height }
        );
      };
      const syncMediaState = () => {
        const nextDuration = Number.isFinite(video.duration)
          ? video.duration
          : 0;
        const {
          enabled,
          start,
          duration: segmentDuration
        } = loopConfigRef.current;
        let nextTime = Math.min(
          video.currentTime || 0,
          nextDuration || video.currentTime || 0
        );

        if (
          enabled &&
          segmentDuration > 0 &&
          nextTime >= start + segmentDuration
        ) {
          video.currentTime = start;
          nextTime = start;
        }

        setVideoDuration(nextDuration);
        const shouldDeferToFrameSync =
          !video.paused &&
          !video.ended &&
          !video.seeking &&
          !isScrubbingRef.current;

        if (shouldDeferToFrameSync) {
          return;
        }

        syncProgressUi(nextTime, nextDuration, {
          instant: nextTime < currentTimeRef.current
        });

        if (!isScrubbingRef.current) {
          setCurrentPlaybackTime(nextTime);
        }
      };

      const handleReady = () => {
        const {
          enabled,
          start,
          duration: segmentDuration
        } = loopConfigRef.current;

        if (
          enabled &&
          segmentDuration > 0 &&
          start > 0 &&
          video.currentTime < start
        ) {
          video.currentTime = start;
        }

        syncVideoGeometry();
        syncMediaState();
        setLoading(false);
      };
      const handleError = () => setLoading(false);

      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('resize', syncVideoGeometry);
      video.addEventListener('loadedmetadata', handleReady);
      video.addEventListener('durationchange', handleReady);
      video.addEventListener('loadeddata', handleReady);
      video.addEventListener('canplay', handleReady);
      video.addEventListener('playing', handleReady);
      video.addEventListener('timeupdate', syncMediaState);
      video.addEventListener('error', handleError);

      if (video.readyState >= 1) {
        handleReady();
      }

      return () => {
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('resize', syncVideoGeometry);
        video.removeEventListener('loadedmetadata', handleReady);
        video.removeEventListener('durationchange', handleReady);
        video.removeEventListener('loadeddata', handleReady);
        video.removeEventListener('canplay', handleReady);
        video.removeEventListener('playing', handleReady);
        video.removeEventListener('timeupdate', syncMediaState);
        video.removeEventListener('error', handleError);
      };
    }, [setCurrentPlaybackTime, setVideoDuration, src, syncProgressUi]);

    React.useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (!containerRef.current?.contains(document.activeElement)) return;
        if (event.target instanceof HTMLInputElement) return;
        switch (event.key) {
          case ' ':
          case 'k':
            event.preventDefault();
            togglePlay();
            break;
          case 'm':
            event.preventDefault();
            toggleMute();
            break;
          case 'f':
            event.preventDefault();
            void toggleFullscreen();
            break;
          case 'ArrowLeft':
            event.preventDefault();
            skipBy(-10);
            break;
          case 'ArrowRight':
            event.preventDefault();
            skipBy(10);
            break;
          case 'ArrowUp':
            event.preventDefault();
            applyVolume(volume + 0.1);
            break;
          case 'ArrowDown':
            event.preventDefault();
            applyVolume(volume - 0.1);
            break;
        }
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }, [applyVolume, skipBy, toggleFullscreen, toggleMute, togglePlay, volume]);

    const showSkipIntro =
      introEndTime > 0 && duration > 0 && currentTime < introEndTime;

    return (
      <div
        ref={containerRef}
        className={cn(
          videoPlayerVariants({ size }),
          className,
          fullscreen &&
            'h-[100dvh] max-h-none w-[100dvw] max-w-none rounded-none',
          playing && !mouseActive && 'cursor-none'
        )}
        style={{
          borderRadius: fullscreen ? undefined : 'var(--tenant-node-radius)',
          backgroundColor: 'transparent',
          aspectRatio: fullscreen ? undefined : parseAspectRatio(aspectRatio)
        }}
        onMouseMove={revealControls}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => {
          if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
          if (playing) {
            handleMouseLeave();
          } else {
            setControlsVisible(false);
          }
        }}
        onFocusCapture={() => {
          setFocusedWithin(true);
          revealControls();
        }}
        onBlurCapture={(event) => {
          if (
            event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            return;
          }
          setFocusedWithin(false);
          revealControls();
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (touch)
            touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const touch = event.changedTouches[0];
          const start = touchStartRef.current;
          if (!touch || !start) return;
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          const now = Date.now();
          if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
            if (now - lastTapRef.current < 300) togglePlay();
            else revealControls();
            lastTapRef.current = now;
          } else if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            skipBy(dx > 0 ? 10 : -10);
          } else if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) {
            applyVolume(volume + (dy > 0 ? -0.1 : 0.1));
          }
          touchStartRef.current = null;
        }}
        tabIndex={0}
      >
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 ">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : null}

        {muted && !loading ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleMute();
            }}
            className="absolute left-1/2 top-4 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-black/70"
          >
            <VolumeX className="h-4 w-4 text-red-400" />
            Enable sound
          </button>
        ) : null}

        <div
          className="z-10 absolute inset-0"
          onClick={() => {
            togglePlay();
            if (playing) handleMouseEnter();
            else handleMouseLeave();
          }}
        />

        <video
          ref={videoRef}
          src={src}
          poster={poster}
          loop={loop && !(loopingSegment && loopDuration > 0)}
          className={cn(
            'bg-transparent object-contain max-md:object-cover ',
            fullscreen ? fullscreenVideoClassName : 'h-full w-full ',
            videoClassName
          )}
          playsInline
          preload="metadata"
          muted={muted}
          title={title}
          onPlay={() => {
            setPlaying(true);
            setLoading(false);
            // revealControls();
          }}
          onPause={() => {
            setPlaying(false);
            setControlsVisible(true);
          }}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onVolumeChange={(event) => {
            const video = event.currentTarget;
            setMuted(video.muted || video.volume === 0);
            setVolume(video.volume);
            if (video.volume > 0) lastVolumeRef.current = video.volume;
          }}
          onEnded={() => {
            setPlaying(false);
            setControlsVisible(true);
            userPausedRef.current = false;
          }}
          {...props}
        />

        <div
          className={cn(
            'pointer-events-none absolute inset-0 transition-opacity duration-300',
            controlsVisible ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/90 via-black/48 to-transparent" />
        </div>

        {!playing && !loading && controlsVisible ? (
          <div className="animate-in fade-in pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition duration-300">
              <Play
                className="ml-1 h-10 w-10 fill-current text-white"
                strokeWidth={0}
              />
            </div>
          </div>
        ) : null}

        {showControls ? (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 z-20 transition-all duration-300',
              controlsVisible
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-2 opacity-0'
            )}
          >
            <div className="pointer-events-none relative mt-12 px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="group/progress flex items-center gap-3 text-white">
                <span className="min-w-[36px] text-xs tabular-nums">
                  {formatTime(currentTime)}
                </span>
                <div
                  ref={progressBarRef}
                  className="relative flex-1"
                  style={
                    {
                      '--video-progress': 0
                    } as React.CSSProperties
                  }
                >
                  <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/30 transition-all group-hover/progress:h-1" />
                  <div
                    ref={progressFillRef}
                    className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 origin-left rounded-full bg-white will-change-transform group-hover/progress:h-1"
                    style={{
                      transitionDuration: `${VISUAL_PROGRESS_TRANSITION}ms`,
                      transform:
                        'translate3d(0, -50%, 0) scaleX(var(--video-progress, 0))'
                    }}
                  />
                  {duration > 0 ? (
                    <div
                      ref={progressThumbRef}
                      className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.18)] transition-opacity group-hover/progress:opacity-100"
                      style={{
                        transitionDuration: `${VISUAL_PROGRESS_TRANSITION}ms`,
                        left: 'calc(var(--video-progress, 0) * 100%)',
                        opacity: controlsVisible ? 1 : 0
                      }}
                    />
                  ) : null}
                  <input
                    ref={seekInputRef}
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.01}
                    defaultValue={0}
                    onInput={(event) => {
                      const next = event.currentTarget.valueAsNumber;
                      updateSeekPreview(next);
                    }}
                    onChange={(event) => {
                      const next = event.currentTarget.valueAsNumber;
                      updateSeekPreview(next);
                      commitSeek(next);
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setIsScrubbing(true);
                    }}
                    onPointerUp={(event) => {
                      event.stopPropagation();
                      const next = event.currentTarget.valueAsNumber;
                      commitSeek(next);
                      setIsScrubbing(false);
                    }}
                    onPointerCancel={() => setIsScrubbing(false)}
                    onClick={(event) => event.stopPropagation()}
                    className="pointer-events-auto relative h-5 w-full cursor-pointer appearance-none bg-transparent opacity-0"
                    aria-label="Seek video"
                  />
                </div>
                <span className="min-w-[36px] text-right text-xs tabular-nums">
                  {formatTime(duration)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-white">
                <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      togglePlay();
                    }}
                    className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    aria-label={playing ? 'Pause video' : 'Play video'}
                  >
                    {playing ? (
                      <Pause className="h-4 w-4 fill-current" strokeWidth={0} />
                    ) : (
                      <Play
                        className="ml-0.5 h-4 w-4 fill-current"
                        strokeWidth={0}
                      />
                    )}
                  </button>

                  {showSkipIntro ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        skipIntro();
                      }}
                      className="pointer-events-auto hidden h-8 rounded-full bg-white/10 px-3 text-xs font-medium text-white transition hover:bg-white/18 sm:inline-flex sm:items-center"
                    >
                      <SkipForward className="mr-1.5 h-3.5 w-3.5" />
                      Skip intro
                    </button>
                  ) : null}

                  {loopDuration > 0 ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setLoopingSegment((current) => !current);
                      }}
                      className={cn(
                        'pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
                        loopingSegment
                          ? 'bg-white/14 text-white'
                          : 'text-white/70 hover:bg-white/12 hover:text-white'
                      )}
                      aria-label="Toggle loop segment"
                    >
                      <Repeat className="h-4 w-4" />
                    </button>
                  ) : null}

                  <div
                    className="pointer-events-auto flex items-center"
                    onMouseEnter={() => {
                      if (volumeTimerRef.current)
                        clearTimeout(volumeTimerRef.current);
                      setVolumeOpen(true);
                    }}
                    onMouseLeave={() => {
                      if (volumeTimerRef.current)
                        clearTimeout(volumeTimerRef.current);
                      volumeTimerRef.current = setTimeout(
                        () => setVolumeOpen(false),
                        120
                      );
                    }}
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleMute();
                      }}
                      className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/12 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      aria-label={muted ? 'Unmute video' : 'Mute video'}
                    >
                      {muted || volume === 0 ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                    <div
                      className={cn(
                        'overflow-hidden transition-all duration-200',
                        volumeOpen ? 'ml-1 w-16' : 'w-0'
                      )}
                    >
                      <div className="relative h-5 w-full">
                        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/30" />
                        <div
                          className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white"
                          style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                        />
                        <div
                          className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                          style={{ left: `${(muted ? 0 : volume) * 100}%` }}
                        />
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={muted ? 0 : volume}
                          onChange={(event) => {
                            event.stopPropagation();
                            applyVolume(Number.parseFloat(event.target.value));
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          className="pointer-events-auto absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
                          aria-label="Video volume"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                  {material ? (
                    <a
                      href={material}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/12 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      <FolderDown className="h-4 w-4" />
                    </a>
                  ) : null}

                  <div className="pointer-events-auto relative">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSettingsOpen((current) => !current);
                      }}
                      className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/12 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      aria-label="Playback settings"
                    >
                      {rate !== 1 ? (
                        <span className="text-[11px] font-semibold">
                          {rate}x
                        </span>
                      ) : (
                        <Settings className="h-4 w-4" />
                      )}
                    </button>

                    {settingsOpen ? (
                      <div className="pointer-events-auto absolute bottom-11 right-0 w-20 rounded-xl border border-white/10 bg-black/88 p-1.5 shadow-[0_14px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
                        {RATES.map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setPlaybackRate(value)}
                            className={cn(
                              'flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-xs transition',
                              rate === value
                                ? 'bg-white text-black'
                                : 'text-white hover:bg-white/10'
                            )}
                          >
                            {value}x
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleFullscreen();
                    }}
                    className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/12 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    aria-label={
                      fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
                    }
                  >
                    {fullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {showSkipIntro ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    skipIntro();
                  }}
                  className="pointer-events-auto absolute right-4 top-4 inline-flex h-8 items-center rounded-full bg-black/55 px-3 text-xs font-medium text-white transition hover:bg-black/72 sm:hidden"
                >
                  <SkipForward className="mr-1.5 h-3.5 w-3.5" />
                  Skip
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export { VideoPlayer, videoPlayerVariants };
