"use client";

import { KNOWN_MODELS } from "@/lib/provenance";
import { Select } from "@/components/ui/select";
import type { AIProvider } from "@/types";

interface ModelSelectorProps {
  provider: AIProvider;
  model: string;
  onChange: (provider: AIProvider, model: string) => void;
  disabled?: boolean;
  size?: "sm" | "default";
}

/** Groups models by provider for the optgroup display */
const PROVIDERS: { key: AIProvider; label: string }[] = [
  { key: "openai", label: "OpenAI" },
  { key: "anthropic", label: "Anthropic" },
  { key: "google", label: "Google" },
];

export function ModelSelector({ provider, model, onChange, disabled, size = "default" }: ModelSelectorProps) {
  // Combined value: "provider::model"
  const value = `${provider}::${model}`;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [p, m] = e.target.value.split("::");
    onChange(p as AIProvider, m);
  }

  return (
    <Select
      value={value}
      onChange={handleChange}
      disabled={disabled}
      className={size === "sm" ? "h-7 text-xs" : undefined}
      aria-label="Select AI model"
    >
      {PROVIDERS.map(({ key, label }) => {
        const models = KNOWN_MODELS.filter((m) => m.provider === key);
        if (models.length === 0) return null;
        return (
          <optgroup key={key} label={label}>
            {models.map((m) => (
              <option key={m.model} value={`${m.provider}::${m.model}`}>
                {m.displayName}
              </option>
            ))}
          </optgroup>
        );
      })}
    </Select>
  );
}
