import React from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { cn } from "../../lib/utils";

interface GraphControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  className?: string;
}

function ControlBtn({
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
        "flex items-center justify-center w-7 h-7 rounded-md transition-colors"
      )}
      style={{
        color: "var(--pk-graph-control-text)",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "color-mix(in oklch, var(--pk-graph-node-text) 8%, transparent)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
    >
      {children}
    </button>
  );
}

export function GraphControls({ onZoomIn, onZoomOut, onReset, className }: GraphControlsProps) {
  return (
    <div
      className={cn(
        "absolute top-3 right-3 z-10 flex flex-col gap-0.5 p-1 rounded-lg",
        className
      )}
      style={{
        backgroundColor: "var(--pk-graph-control-bg)",
        border: "1px solid var(--pk-graph-control-border)",
        backdropFilter: "blur(8px)",
      }}
    >
      <ControlBtn onClick={onZoomIn} title="Zoom in">
        <ZoomIn size={14} strokeWidth={2} />
      </ControlBtn>
      <ControlBtn onClick={onZoomOut} title="Zoom out">
        <ZoomOut size={14} strokeWidth={2} />
      </ControlBtn>
      <div style={{ height: 1, backgroundColor: "var(--pk-graph-control-border)", margin: "2px 4px" }} />
      <ControlBtn onClick={onReset} title="Reset layout">
        <RotateCcw size={14} strokeWidth={2} />
      </ControlBtn>
    </div>
  );
}
