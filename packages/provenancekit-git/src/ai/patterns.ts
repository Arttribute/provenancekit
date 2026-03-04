/**
 * AI detection patterns for identifying AI-assisted commits.
 *
 * These patterns are used to detect AI co-authorship from various signals
 * including commit messages, file patterns, and known AI tool signatures.
 *
 * @packageDocumentation
 */

/*─────────────────────────────────────────────────────────────*\
 | AI Tool Registry                                             |
\*─────────────────────────────────────────────────────────────*/

/**
 * Known AI tools and their identifiers.
 */
export interface AIToolInfo {
  /** Tool identifier */
  id: string;

  /** Display name */
  name: string;

  /** Provider/company */
  provider: string;

  /** Known model identifiers */
  models?: string[];

  /** Co-author format in commits */
  coAuthorPatterns?: RegExp[];

  /** File patterns associated with this tool */
  filePatterns?: RegExp[];

  /** Message patterns indicating usage */
  messagePatterns?: RegExp[];
}

/**
 * Registry of known AI coding tools.
 */
export const AI_TOOLS: AIToolInfo[] = [
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    provider: "GitHub/OpenAI",
    models: ["gpt-4", "gpt-3.5-turbo"],
    coAuthorPatterns: [
      /Co-authored-by:.*GitHub Copilot/i,
      /Co-authored-by:.*copilot\[bot\]/i,
      /Co-authored-by:.*<copilot@github\.com>/i,
    ],
    filePatterns: [/\.github\/copilot/, /\.copilot/],
    messagePatterns: [
      /\[Copilot\]/i,
      /Generated (?:by|with|using) (?:GitHub )?Copilot/i,
    ],
  },
  {
    id: "claude",
    name: "Claude",
    provider: "Anthropic",
    models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-3.5-sonnet", "claude-opus-4"],
    coAuthorPatterns: [
      /Co-authored-by:.*Claude/i,
      /Co-authored-by:.*Anthropic/i,
      /Co-authored-by:.*<noreply@anthropic\.com>/i,
    ],
    messagePatterns: [
      /\[Claude\]/i,
      /Generated (?:by|with|using) Claude/i,
      /Co-Authored-By:.*Claude/i,
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    provider: "OpenAI",
    models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini"],
    coAuthorPatterns: [
      /Co-authored-by:.*ChatGPT/i,
      /Co-authored-by:.*OpenAI/i,
    ],
    messagePatterns: [
      /\[ChatGPT\]/i,
      /\[GPT-?4\]/i,
      /Generated (?:by|with|using) (?:ChatGPT|GPT|OpenAI)/i,
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    provider: "Cursor",
    models: ["gpt-4", "claude-3-opus", "claude-3.5-sonnet"],
    filePatterns: [/\.cursor\//, /\.cursorignore/],
    coAuthorPatterns: [/Co-authored-by:.*Cursor/i],
    messagePatterns: [
      /\[Cursor\]/i,
      /Generated (?:by|with|using) Cursor/i,
    ],
  },
  {
    id: "aider",
    name: "Aider",
    provider: "Aider",
    filePatterns: [/\.aider/, /\.aider\.conf\.yml/],
    coAuthorPatterns: [
      /Co-authored-by:.*aider/i,
      /aider:/i,
    ],
    messagePatterns: [
      /^aider:/i,
      /\[aider\]/i,
    ],
  },
  {
    id: "codeium",
    name: "Codeium",
    provider: "Codeium",
    coAuthorPatterns: [/Co-authored-by:.*Codeium/i],
    messagePatterns: [
      /\[Codeium\]/i,
      /Generated (?:by|with|using) Codeium/i,
    ],
  },
  {
    id: "tabnine",
    name: "Tabnine",
    provider: "Tabnine",
    coAuthorPatterns: [/Co-authored-by:.*Tabnine/i],
    messagePatterns: [
      /\[Tabnine\]/i,
      /Generated (?:by|with|using) Tabnine/i,
    ],
  },
  {
    id: "amazon-q",
    name: "Amazon Q Developer",
    provider: "Amazon",
    coAuthorPatterns: [
      /Co-authored-by:.*Amazon Q/i,
      /Co-authored-by:.*CodeWhisperer/i,
    ],
    messagePatterns: [
      /\[Amazon Q\]/i,
      /\[CodeWhisperer\]/i,
      /Generated (?:by|with|using) (?:Amazon Q|CodeWhisperer)/i,
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    provider: "Google",
    models: ["gemini-pro", "gemini-ultra", "gemini-1.5-pro"],
    coAuthorPatterns: [
      /Co-authored-by:.*Gemini/i,
      /Co-authored-by:.*Google AI/i,
    ],
    messagePatterns: [
      /\[Gemini\]/i,
      /Generated (?:by|with|using) Gemini/i,
    ],
  },
  {
    id: "windsurf",
    name: "Windsurf",
    provider: "Codeium",
    coAuthorPatterns: [/Co-authored-by:.*Windsurf/i],
    messagePatterns: [
      /\[Windsurf\]/i,
      /Generated (?:by|with|using) Windsurf/i,
    ],
  },
  {
    id: "sourcegraph-cody",
    name: "Cody",
    provider: "Sourcegraph",
    coAuthorPatterns: [
      /Co-authored-by:.*Cody/i,
      /Co-authored-by:.*Sourcegraph/i,
    ],
    messagePatterns: [
      /\[Cody\]/i,
      /Generated (?:by|with|using) (?:Cody|Sourcegraph)/i,
    ],
  },
];

/*─────────────────────────────────────────────────────────────*\
 | Generic AI Patterns                                          |
\*─────────────────────────────────────────────────────────────*/

/**
 * Generic patterns that suggest AI involvement without identifying specific tool.
 */
export const GENERIC_AI_PATTERNS = {
  /**
   * Commit message patterns suggesting AI assistance.
   */
  commitMessage: [
    /\[AI[- ]?assisted\]/i,
    /\[AI[- ]?generated\]/i,
    /\[LLM\]/i,
    /Generated (?:by|with|using) (?:AI|LLM|machine learning)/i,
    /AI[- ]?assisted (?:code|commit|change)/i,
    /Co-authored-by:.*\[bot\]/i,
    /Co-authored-by:.*AI/i,
  ],

  /**
   * File patterns suggesting AI tool configuration.
   */
  filePatterns: [
    /\.ai[/-]?config/,
    /ai[/-]?assistant/,
    /\.llm/,
    /\.prompts?[/-]/,
  ],

  /**
   * Patterns in code comments suggesting AI generation.
   */
  codeComments: [
    /Generated by AI/i,
    /AI-generated/i,
    /Created with assistance from/i,
    /Suggested by AI/i,
  ],
};

/*─────────────────────────────────────────────────────────────*\
 | Pattern Matching Utilities                                   |
\*─────────────────────────────────────────────────────────────*/

/**
 * Result of pattern matching.
 */
export interface PatternMatch {
  /** The pattern that matched */
  pattern: RegExp;

  /** The matched text */
  match: string;

  /** Category of the match */
  category: "coAuthor" | "message" | "file" | "generic";

  /** Detected tool (if specific tool pattern) */
  tool?: AIToolInfo;
}

/**
 * Check if a commit message contains AI-related patterns.
 *
 * @param message - Commit message to check
 * @returns Array of matches found
 */
export function matchCommitMessage(message: string): PatternMatch[] {
  const matches: PatternMatch[] = [];

  // Check tool-specific patterns
  for (const tool of AI_TOOLS) {
    // Check co-author patterns
    for (const pattern of tool.coAuthorPatterns ?? []) {
      const match = message.match(pattern);
      if (match) {
        matches.push({
          pattern,
          match: match[0],
          category: "coAuthor",
          tool,
        });
      }
    }

    // Check message patterns
    for (const pattern of tool.messagePatterns ?? []) {
      const match = message.match(pattern);
      if (match) {
        matches.push({
          pattern,
          match: match[0],
          category: "message",
          tool,
        });
      }
    }
  }

  // Check generic patterns
  for (const pattern of GENERIC_AI_PATTERNS.commitMessage) {
    const match = message.match(pattern);
    if (match) {
      // Avoid duplicates if already matched by specific tool
      const isDuplicate = matches.some(
        (m) => m.match === match[0] || m.pattern.source === pattern.source
      );
      if (!isDuplicate) {
        matches.push({
          pattern,
          match: match[0],
          category: "generic",
        });
      }
    }
  }

  return matches;
}

/**
 * Check if files in a commit suggest AI tool usage.
 *
 * @param files - Array of file paths
 * @returns Array of matches found
 */
export function matchFiles(files: string[]): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (const file of files) {
    // Check tool-specific patterns
    for (const tool of AI_TOOLS) {
      for (const pattern of tool.filePatterns ?? []) {
        if (pattern.test(file)) {
          matches.push({
            pattern,
            match: file,
            category: "file",
            tool,
          });
        }
      }
    }

    // Check generic patterns
    for (const pattern of GENERIC_AI_PATTERNS.filePatterns) {
      if (pattern.test(file)) {
        matches.push({
          pattern,
          match: file,
          category: "file",
        });
      }
    }
  }

  return matches;
}

/**
 * Get tool info by ID.
 *
 * @param id - Tool identifier
 * @returns Tool info or undefined
 */
export function getToolById(id: string): AIToolInfo | undefined {
  return AI_TOOLS.find((t) => t.id === id);
}

/**
 * Get tool info by name (case-insensitive).
 *
 * @param name - Tool name
 * @returns Tool info or undefined
 */
export function getToolByName(name: string): AIToolInfo | undefined {
  const lowerName = name.toLowerCase();
  return AI_TOOLS.find((t) => t.name.toLowerCase() === lowerName);
}

/**
 * Get all tools from a specific provider.
 *
 * @param provider - Provider name
 * @returns Array of tools from that provider
 */
export function getToolsByProvider(provider: string): AIToolInfo[] {
  const lowerProvider = provider.toLowerCase();
  return AI_TOOLS.filter((t) => t.provider.toLowerCase().includes(lowerProvider));
}
