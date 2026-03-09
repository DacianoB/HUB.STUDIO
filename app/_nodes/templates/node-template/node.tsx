"use client";

type NodeTemplateProps = {
  gridNodeId?: string;
};

export default function NodeTemplate({}: NodeTemplateProps) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-xl border border-white/10 bg-black/30 text-sm text-white/80">
      Node template
    </div>
  );
}
