// 修仙模拟器 - LLM 服务 / Phase-K prompt augmentation 域
// 拆分自 llm.ts：Phase-K snippet 注册表（module-level 单例数组）+ register*/apply/diagnostics/reset
// ======================== Phase-K Worker C: LLM prompt augmentation registry ========================
// Three Phase-J helpers (textHealth / slotMapping / cross-system continuity) were added
// to engine.ts but were not actually wired into the live system prompt sent to the LLM.
// Phase-K wires them here via a registry of snippets + an applier that the call sites
// can use to compose the final system prompt.
//
// PHASE_K_LLM_PROMPT_AUGMENTATION_REGISTRY is a sentinel comment so the
// verifyLLMPromptAugmentation() smoke can detect that this file has been wired.

/* PHASE_K_LLM_PROMPT_AUGMENTATION_REGISTRY */

export interface PhaseKLLMSnippetSlot {
  hookName: string;
  hookPosition: "tail" | "head";
  promptSnippet: string;
  charLimit: number;
  snippetId: string;
}

const PHASE_K_LLM_SNIPPET_SLOTS: PhaseKLLMSnippetSlot[] = [];
const PHASE_K_LLM_HOOK_NAMES: string[] = [];

/* PHASE_K_LLM_PROMPT_HOOK_TEXT_HEALTH */
/* PHASE_K_LLM_PROMPT_HOOK_SLOT_MAPPING */
/* PHASE_K_LLM_PROMPT_HOOK_CROSS_SYSTEM_CONTINUITY */

/**
 * Phase-K LLM hook 1/3: register a text-health snippet.
 *  - snippet: output of engine.wireTextHealthToLLMPrompt(...)
 * Returns the registered snippet slot, replacing any previous one with the same hookName.
 */
export function registerPhaseKTextHealthSnippet(snippet: PhaseKLLMSnippetSlot): PhaseKLLMSnippetSlot {
  return _phaseKRegisterOrReplace(snippet);
}

/**
 * Phase-K LLM hook 2/3: register a slot-mapping snippet.
 */
export function registerPhaseKSlotMappingSnippet(snippet: PhaseKLLMSnippetSlot): PhaseKLLMSnippetSlot {
  return _phaseKRegisterOrReplace(snippet);
}

/**
 * Phase-K LLM hook 3/3: register a cross-system continuity snippet.
 */
export function registerPhaseKContinuitySnippet(snippet: PhaseKLLMSnippetSlot): PhaseKLLMSnippetSlot {
  return _phaseKRegisterOrReplace(snippet);
}

function _phaseKRegisterOrReplace(snippet: PhaseKLLMSnippetSlot): PhaseKLLMSnippetSlot {
  if (!snippet || typeof snippet !== "object") {
    throw new Error("phase-k: snippet must be an object");
  }
  if (typeof snippet.hookName !== "string" || snippet.hookName.length === 0) {
    throw new Error("phase-k: snippet.hookName is required");
  }
  if (snippet.hookPosition !== "tail" && snippet.hookPosition !== "head") {
    snippet.hookPosition = "tail";
  }
  if (typeof snippet.promptSnippet !== "string") {
    snippet.promptSnippet = String(snippet.promptSnippet || "");
  }
  for (let i = 0; i < PHASE_K_LLM_SNIPPET_SLOTS.length; i++) {
    if (PHASE_K_LLM_SNIPPET_SLOTS[i].hookName === snippet.hookName) {
      PHASE_K_LLM_SNIPPET_SLOTS[i] = snippet;
      if (PHASE_K_LLM_HOOK_NAMES.indexOf(snippet.hookName) < 0) {
        PHASE_K_LLM_HOOK_NAMES.push(snippet.hookName);
      }
      return snippet;
    }
  }
  PHASE_K_LLM_SNIPPET_SLOTS.push(snippet);
  if (PHASE_K_LLM_HOOK_NAMES.indexOf(snippet.hookName) < 0) {
    PHASE_K_LLM_HOOK_NAMES.push(snippet.hookName);
  }
  return snippet;
}

/**
 * Apply all registered Phase-K snippets to a system prompt.
 *  - baseSystemPrompt: the existing system prompt text
 * Returns: baseSystemPrompt with all "tail" snippets appended (in registration order)
 * and all "head" snippets prepended (in registration order).
 *
 * Snippets whose hookName is not currently registered are silently skipped, so this
 * helper is safe to call even when some wires have not been registered yet.
 */
export function applyPhaseKLLMPromptAugmentation(baseSystemPrompt: string): string {
  const base = typeof baseSystemPrompt === "string" ? baseSystemPrompt : "";
  const heads: string[] = [];
  const tails: string[] = [];
  for (const s of PHASE_K_LLM_SNIPPET_SLOTS) {
    if (!s || typeof s.promptSnippet !== "string" || s.promptSnippet.length === 0) continue;
    if (s.hookPosition === "head") {
      heads.push(s.promptSnippet);
    } else {
      tails.push(s.promptSnippet);
    }
  }
  if (heads.length === 0 && tails.length === 0) return base;
  const parts: string[] = [];
  if (heads.length > 0) parts.push(heads.join("\n\n"));
  if (base.length > 0) parts.push(base);
  if (tails.length > 0) parts.push(tails.join("\n\n"));
  return parts.join("\n\n");
}

/**
 * Diagnostics: how many snippets are currently registered. Useful for unit tests and
 * for verifyLLMPromptAugmentation-style audits. Does NOT mutate state.
 */
export function getPhaseKLLMSnippetDiagnostics(): {
  registeredCount: number;
  hookNames: string[];
} {
  return {
    registeredCount: PHASE_K_LLM_SNIPPET_SLOTS.length,
    hookNames: PHASE_K_LLM_HOOK_NAMES.slice(),
  };
}

/**
 * Test-only: clear all registered snippets. Production code should never call this;
 * it exists so smoke tests can reset state between cases without polluting each other.
 */
export function __resetPhaseKLLMSnippetsForTest(): void {
  PHASE_K_LLM_SNIPPET_SLOTS.length = 0;
  PHASE_K_LLM_HOOK_NAMES.length = 0;
}
