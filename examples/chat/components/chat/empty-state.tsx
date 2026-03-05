"use client";

import { MessageSquare, Sparkles, Shield } from "lucide-react";

const STARTER_PROMPTS = [
  "Explain how ProvenanceKit tracks AI-generated content",
  "Write a short story about a robot who discovers art",
  "What are the key principles of provenance in digital media?",
  "Help me brainstorm ideas for a sustainable tech startup",
];

interface EmptyStateProps {
  onPromptClick?: (prompt: string) => void;
}

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-16 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
        <MessageSquare className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
      <p className="text-muted-foreground text-sm max-w-md mb-8">
        Every response is automatically provenance-tracked — you can verify who created
        what, when, and with which AI model.
      </p>

      {/* Provenance indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-8 bg-muted px-3 py-1.5 rounded-full">
        <Shield className="h-3 w-3 text-emerald-500" />
        <span>Provenance tracking active via ProvenanceKit</span>
      </div>

      {/* Quick-start prompts */}
      {onPromptClick && (
        <div className="w-full max-w-lg space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Try one of these
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onPromptClick(prompt)}
                className="text-left text-sm rounded-xl border border-border bg-card px-3 py-2.5 hover:bg-accent hover:border-ring transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
