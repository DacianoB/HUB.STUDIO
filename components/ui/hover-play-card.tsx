"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play } from "lucide-react";

import { cn } from "~/lib/utils";

import { Button } from "~/components/ui/button";

type HoverPlayCardProps = {
  src: string;
  poster?: string;
  title?: string;
  className?: string;
  loop?: boolean;
  mutedOnHover?: boolean;
  onOpen?: () => void;
};

export default function HoverPlayCard({
  src,
  poster,
  title,
  className,
  loop = false,
  mutedOnHover = true,
  onOpen,
}: HoverPlayCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userStarted, setUserStarted] = useState(false);
  const [prevMuted, setPrevMuted] = useState<boolean | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let ignore = false;

    const doPlayMuted = async () => {
      if (prevMuted === null) {
        setPrevMuted(video.muted);
      }

      if (mutedOnHover) {
        video.muted = true;
      }

      try {
        await video.play();
        if (!ignore) setIsPlaying(true);
      } catch {
        if (!ignore) setIsPlaying(false);
      }
    };

    const doPause = () => {
      video.pause();
      setIsPlaying(false);

      if (!userStarted && prevMuted !== null) {
        video.muted = prevMuted;
      }
    };

    if (isHovering && !userStarted) {
      void doPlayMuted();
    } else if (!isHovering && !userStarted) {
      doPause();
    }

    return () => {
      ignore = true;
    };
  }, [isHovering, mutedOnHover, prevMuted, userStarted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setUserStarted(false);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  const handleIconClick = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (!isPlaying) {
      setUserStarted(true);
      video.muted = false;
      setPrevMuted(false);

      try {
        await video.play();
        setIsPlaying(true);
      } catch (error) {
        console.error("Play failed:", error);
        setIsPlaying(false);
      }
      return;
    }

    video.pause();
    setIsPlaying(false);
  };

  const handleOpen = () => {
    onOpen?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onOpen) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    handleOpen();
  };

  return (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-sm",
        onOpen && "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70",
        className,
      )}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={title ? `Open ${title}` : "Open video"}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        loop={loop}
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/70" />

      <AnimatePresence>
        {(isHovering || !isPlaying) && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <Button
              size="icon"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                void handleIconClick();
              }}
              className="pointer-events-auto h-16 w-16 rounded-full bg-black/25 text-white hover:bg-black/45"
              aria-label={isPlaying ? "Pause video" : "Play video"}
            >
              {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-3 left-3 rounded-full bg-black/35 px-2 py-1 text-xs text-white/85 backdrop-blur">
        {isPlaying ? "Playing" : "Preview"}
      </div>
    </div>
  );
}
