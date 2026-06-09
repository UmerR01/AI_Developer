/**
 * useContextManager — Tiered Context Strategy hook
 *
 * Tracks per-session state for the tiered context strategy:
 *   - fileSummaryCache  : path → summary string (populated on demand)
 *   - appliedPatches    : ordered list of unified-diff strings
 *   - modifyTurnCount   : number of modify operations on each file
 *   - estimatedTokens   : running token budget estimate
 *   - isCompacted       : true after a context_compacted WS event is received
 *
 * Usage:
 *   const ctx = useContextManager({ userId, projectId });
 *   // before sending a WS message:
 *   const enrichedPrompt = await ctx.buildPayload(userPrompt, activeFilePath);
 *   // after the model replies with a diff:
 *   ctx.recordPatch(diffString);
 *   // listen for compaction events from the WS:
 *   ctx.onServerEvent(wsMessage);
 */

"use client";

import { useCallback, useRef, useState } from "react";
import {
  agentProjectKey,
  buildContextPayload,
  detectOperationType,
  summarizeFile,
  type FileSummaryResult,
} from "@/lib/agentClient";

// ── Token budget thresholds (must match backend env defaults) ─────────────────
const CLIENT_COMPACT_THRESHOLD = parseInt(
  process.env.NEXT_PUBLIC_CONTEXT_COMPACT_THRESHOLD ?? "100000",
  10,
);

// Rough token estimator (matches tiktoken cl100k_base closely for English)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContextManagerState {
  estimatedTokens: number;
  pctUsed: number;
  isCompacted: boolean;
  /** "threshold" = auto-compacted at budget limit; "rate_limit" = 429 triggered compaction */
  compactReason: "threshold" | "rate_limit" | null;
  patchCount: number;
}

export interface ContextManager {
  state: ContextManagerState;
  /** Build the tiered context payload for the next WS message. */
  buildPayload: (prompt: string, filePath?: string) => Promise<string>;
  /** Record a diff/patch returned by the model for the active file. */
  recordPatch: (diff: string, filePath?: string) => void;
  /** Invalidate summary cache for a file (call after the agent writes it). */
  invalidateSummary: (filePath: string) => void;
  /** Process a raw WS event object. Call on every incoming WS message. */
  onServerEvent: (event: Record<string, unknown>) => void;
  /** Hard reset — clears all state for this session. */
  resetContext: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useContextManager(opts: {
  userId: string;
  projectId: string;
}): ContextManager {
  const { userId, projectId } = opts;
  const pid = agentProjectKey(projectId);

  // Refs (mutable without re-render)
  const summaryCache = useRef<Map<string, FileSummaryResult>>(new Map());
  const patchesByFile = useRef<Map<string, string[]>>(new Map());
  const modifyTurnByFile = useRef<Map<string, number>>(new Map());
  const totalTokensRef = useRef<number>(0);

  // State (triggers re-render for UI badge)
  const [isCompacted, setIsCompacted] = useState(false);
  const [compactReason, setCompactReason] = useState<"threshold" | "rate_limit" | null>(null);
  const [estimatedTokens, setEstimatedTokens] = useState(0);
  const [patchCount, setPatchCount] = useState(0);

  // ── Internal helpers ────────────────────────────────────────────────────────

  const addTokens = useCallback((n: number) => {
    totalTokensRef.current += n;
    setEstimatedTokens(totalTokensRef.current);
  }, []);

  const getSummary = useCallback(
    async (filePath: string, forceRefresh = false): Promise<string | null> => {
      const cached = summaryCache.current.get(filePath);
      if (cached && !forceRefresh) return cached.summary;

      const result = await summarizeFile(userId, pid, filePath, forceRefresh);
      if (result) {
        summaryCache.current.set(filePath, result);
        return result.summary;
      }
      return null;
    },
    [userId, pid],
  );

  // ── Public API ──────────────────────────────────────────────────────────────

  const buildPayload = useCallback(
    async (prompt: string, filePath?: string): Promise<string> => {
      const opType = detectOperationType(prompt);
      let fileSummary: string | null = null;

      if (filePath) {
        fileSummary = await getSummary(filePath);
      }

      const currentTurn = filePath
        ? (modifyTurnByFile.current.get(filePath) ?? 0)
        : 0;
      const isFirstModify = currentTurn === 0;
      const appliedPatches = filePath
        ? (patchesByFile.current.get(filePath) ?? [])
        : [];

      const enrichedPrompt = buildContextPayload({
        prompt,
        opType,
        fileSummary,
        appliedPatches,
        isFirstModify,
      });

      addTokens(estimateTokens(enrichedPrompt));
      return enrichedPrompt;
    },
    [getSummary, addTokens],
  );

  const recordPatch = useCallback((diff: string, filePath?: string) => {
    const key = filePath ?? "__global__";
    if (!patchesByFile.current.has(key)) {
      patchesByFile.current.set(key, []);
    }
    patchesByFile.current.get(key)!.push(diff);

    // Increment modify turn counter
    modifyTurnByFile.current.set(
      key,
      (modifyTurnByFile.current.get(key) ?? 0) + 1,
    );

    addTokens(estimateTokens(diff));
    setPatchCount((c) => c + 1);
  }, [addTokens]);

  const invalidateSummary = useCallback((filePath: string) => {
    summaryCache.current.delete(filePath);
  }, []);

  const onServerEvent = useCallback(
    (event: Record<string, unknown>) => {
      const type = event["type"] as string | undefined;

      if (type === "context_compacted") {
        // Server performed compaction — sync our client-side token estimate
        const tokensAfter = (event["tokens_after"] as number | undefined) ?? 0;
        const reason = (event["reason"] as string | undefined) ?? "";
        totalTokensRef.current = tokensAfter;
        setEstimatedTokens(tokensAfter);
        setIsCompacted(true);
        setCompactReason(reason === "429_rate_limit" ? "rate_limit" : "threshold");
        // Clear patch history — they're now folded into server-side summary
        patchesByFile.current.clear();
        modifyTurnByFile.current.clear();
        setPatchCount(0);
      }

      if (type === "run_complete") {
        const serverTokens = event["tokens_estimated"] as number | undefined;
        if (serverTokens !== undefined) {
          // Trust the server's authoritative count
          totalTokensRef.current = serverTokens;
          setEstimatedTokens(serverTokens);
        }
      }

      if (type === "generated_file") {
        // Whenever the agent writes a file, invalidate its summary cache
        const path = event["path"] as string | undefined;
        if (path) invalidateSummary(path);
      }
    },
    [invalidateSummary],
  );

  const resetContext = useCallback(() => {
    summaryCache.current.clear();
    patchesByFile.current.clear();
    modifyTurnByFile.current.clear();
    totalTokensRef.current = 0;
    setEstimatedTokens(0);
    setIsCompacted(false);
    setCompactReason(null);
    setPatchCount(0);
  }, []);

  const pctUsed = Math.min(
    100,
    Math.round((estimatedTokens / CLIENT_COMPACT_THRESHOLD) * 100),
  );

  return {
    state: { estimatedTokens, pctUsed, isCompacted, compactReason, patchCount },
    buildPayload,
    recordPatch,
    invalidateSummary,
    onServerEvent,
    resetContext,
  };
}
