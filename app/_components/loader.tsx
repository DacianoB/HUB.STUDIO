"use client";

import { Loader2 } from "lucide-react";

type LoaderSize = "sm" | "md" | "lg";
type LoaderColor = "primary" | "muted" | "white";

interface LoaderProps {
  size?: LoaderSize;
  color?: LoaderColor;
  className?: string;
}

const sizeMap: Record<LoaderSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

const colorMap: Record<LoaderColor, string> = {
  primary: "text-[hsl(var(--primary))]",
  muted: "text-[hsl(var(--muted-foreground))]",
  white: "text-white",
};

export default function Loader({
  size = "md",
  color = "primary",
  className = "",
}: LoaderProps) {
  return <Loader2 className={`animate-spin ${sizeMap[size]} ${colorMap[color]} ${className}`} />;
}
