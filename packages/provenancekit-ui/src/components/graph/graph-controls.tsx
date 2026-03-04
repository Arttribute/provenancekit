import React from "react";
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface GraphControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit?: () => void;
  className?: string;
}

function ControlButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex items-center justify-center size-7 rounded-md",
        "text-[var(--pk-muted-foreground)] hover:text-[var(--pk-foreground)]",
        "hover:bg-[var(--pk-surface-muted)] transition-colors"
      )}
    >
      {children}
    </button>
  );
}

export function GraphControls({
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
  className,
}: GraphControlsProps) {
  return (
    <div
      className={cn(
        "absolute top-3 right-3 z-10 flex flex-col gap-0.5 p-1",
        "rounded-lg border border-[var(--pk-surface-border)]",
        "bg-[var(--pk-surface)] shadow-sm",
        className
      )}
    >
      <ControlButton onClick={onZoomIn} title="Zoom in">
        <ZoomIn size={14} strokeWidth={2} />
      </ControlButton>
      <ControlButton onClick={onZoomOut} title="Zoom out">
        <ZoomOut size={14} strokeWidth={2} />
      </ControlButton>
      <div className="h-px bg-[var(--pk-surface-border)] mx-1 my-0.5" />
      {onFit && (
        <ControlButton onClick={onFit} title="Fit view">
          <Maximize2 size={14} strokeWidth={2} />
        </ControlButton>
      )}
      <ControlButton onClick={onReset} title="Reset layout">
        <RotateCcw size={14} strokeWidth={2} />
      </ControlButton>
    </div>
  );
}
