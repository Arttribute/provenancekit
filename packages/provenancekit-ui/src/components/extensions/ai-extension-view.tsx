import React from "react";
import { Bot, Cpu, Zap, Eye } from "lucide-react";
import { cn } from "../../lib/utils";
import type { AIToolExtension, AIAgentExtension } from "../../lib/extensions";

interface AIToolViewProps {
  extension: AIToolExtension;
  className?: string;
}

interface AIAgentViewProps {
  extension: AIAgentExtension;
  className?: string;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-[var(--pk-muted-foreground)] min-w-[80px] shrink-0">{label}</span>
      <span className="text-xs text-[var(--pk-foreground)] font-medium">{value}</span>
    </div>
  );
}

export function AIExtensionView({
  extension,
  mode = "tool",
  className,
}: {
  extension: AIToolExtension | AIAgentExtension;
  mode?: "tool" | "agent";
  className?: string;
}) {
  if (mode === "agent") {
    const ext = extension as AIAgentExtension;
    return (
      <div className={cn("space-y-1.5", className)}>
        <div className="flex items-center gap-1.5 text-[var(--pk-role-ai)]">
          <Bot size={12} strokeWidth={2} />
          <span className="text-xs font-semibold">AI Agent</span>
        </div>
        {ext.model?.provider && (
          <Field label="Provider" value={ext.model.provider} />
        )}
        {ext.model?.model && (
          <Field label="Model" value={ext.model.model} />
        )}
        {ext.autonomyLevel && (
          <Field label="Autonomy" value={ext.autonomyLevel} />
        )}
        {ext.agentRole && (
          <Field label="Role" value={ext.agentRole} />
        )}
        {ext.framework && (
          <Field label="Framework" value={ext.framework} />
        )}
        {ext.collaborators && ext.collaborators.length > 0 && (
          <Field label="With" value={`${ext.collaborators.length} collaborators`} />
        )}
      </div>
    );
  }

  const ext = extension as AIToolExtension;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5 text-[var(--pk-role-ai)]">
        <Cpu size={12} strokeWidth={2} />
        <span className="text-xs font-semibold">AI Tool</span>
      </div>
      {ext.provider && <Field label="Provider" value={ext.provider} />}
      {ext.model && <Field label="Model" value={ext.model} />}
      {ext.version && <Field label="Version" value={ext.version} />}
      {ext.tokensUsed && (
        <Field label="Tokens" value={`${ext.tokensUsed.toLocaleString()}`} />
      )}
      {ext.generationTime && (
        <Field label="Time" value={`${(ext.generationTime / 1000).toFixed(2)}s`} />
      )}
      {ext.promptHash && (
        <div className="flex items-center gap-1 text-[var(--pk-muted-foreground)]">
          <Eye size={10} />
          <span className="text-xs">Prompt hash recorded</span>
        </div>
      )}
    </div>
  );
}
