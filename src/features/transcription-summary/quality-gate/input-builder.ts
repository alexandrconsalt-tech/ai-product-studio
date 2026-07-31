import type { PipelineContractManifest } from "../contracts/contract-types";
import {
  SummaryQualityGateInputV3Contract,
  SummaryQualityGateInputV3Schema,
  SummaryQualityGatePolicyV3Schema,
  SUMMARY_QUALITY_GATE_POLICY_VERSION,
  SUMMARY_QUALITY_GATE_THRESHOLDS,
  SUMMARY_QUALITY_GATE_WEIGHTS,
  type SummaryQualityGateInputV3,
} from "../contracts/quality-gate-input/v3/contract";
import { QualityGateV3Contract } from "../contracts/quality-gate/v3/contract";
import { validateContractManifest } from "../contracts/manifest";
import { SUMMARY_CRITERIA } from "../contracts/canonical-enums";
import {
  SUMMARY_JUDGE_SCORE_VALUES,
  SummaryJudgeV3Contract,
  SummaryJudgeV3Schema,
} from "../contracts/summary-judges/v3/contract";
import { SummaryV3Contract, SummaryV3Schema } from "../contracts/summary/v3/contract";
import {
  ConversationStoreV3Contract,
  ConversationStoreV3Schema,
} from "../contracts/conversation-store/v3/contract";
import { calculateConversationStoreContentHash } from "../store";
import { calculateSummaryContentHash } from "../summary-judges/input-builder";

export const SUMMARY_QUALITY_GATE_ERROR_CODES = [
  "QUALITY_GATE_VERDICT_MISSING",
  "QUALITY_GATE_DUPLICATE_CRITERION",
  "QUALITY_GATE_HASH_MISMATCH",
  "QUALITY_GATE_VERSION_MISMATCH",
  "QUALITY_GATE_INVALID_SCORE",
  "QUALITY_GATE_INVALID_POLICY",
  "QUALITY_GATE_INPUT_INVALID",
] as const;

export type SummaryQualityGateInputErrorCode =
  (typeof SUMMARY_QUALITY_GATE_ERROR_CODES)[number];

export type SummaryQualityGateInputError = Readonly<{
  errorCode: SummaryQualityGateInputErrorCode;
  message: string;
  criterion?: (typeof SUMMARY_CRITERIA)[number];
}>;

export type SummaryQualityGateInputProvenance = Readonly<{
  runId: string;
  manifestHash: string;
  storeId: string;
  storeContentHash: string;
  summaryHash: string;
}>;

export type BuildSummaryQualityGateInputResult =
  | Readonly<{
      ok: true;
      value: SummaryQualityGateInputV3;
      provenance: SummaryQualityGateInputProvenance;
    }>
  | Readonly<{
      ok: false;
      disposition: "NOT_RUN" | "TECHNICAL_ERROR";
      errors: readonly SummaryQualityGateInputError[];
      provenance: SummaryQualityGateInputProvenance;
    }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, key: string, fallback: string): string {
  return isRecord(value) && typeof value[key] === "string"
    ? value[key]
    : fallback;
}

function deriveProvenance(
  manifest: PipelineContractManifest,
  conversationStore: unknown,
  summary: unknown,
): SummaryQualityGateInputProvenance {
  const storeMeta = isRecord(conversationStore) && isRecord(conversationStore.meta)
    ? conversationStore.meta
    : {};
  return {
    runId: stringField(storeMeta, "run_id", "unknown-run"),
    manifestHash: manifest.manifestHash,
    storeId: stringField(storeMeta, "store_id", "unknown-store"),
    storeContentHash: stringField(conversationStore, "content_hash", "0".repeat(64)),
    summaryHash: calculateSummaryContentHash(summary),
  };
}

function addError(
  errors: SummaryQualityGateInputError[],
  error: SummaryQualityGateInputError,
): void {
  if (!errors.some((entry) =>
    entry.errorCode === error.errorCode
    && entry.criterion === error.criterion
    && entry.message === error.message
  )) {
    errors.push(error);
  }
}

function expectedVerdict(score: unknown): string | null {
  if (score === null) return "technical_error";
  if (score === 100) return "pass";
  if (score === 75) return "warning";
  if ([0, 25, 50].includes(score as number)) return "fail";
  return null;
}

function inspectVerdicts(
  verdicts: readonly unknown[],
  errors: SummaryQualityGateInputError[],
): void {
  for (const criterion of SUMMARY_CRITERIA) {
    const matching = verdicts.filter(
      (verdict) => isRecord(verdict) && verdict.criterion === criterion,
    );
    if (matching.length === 0) {
      addError(errors, {
        errorCode: "QUALITY_GATE_VERDICT_MISSING",
        criterion,
        message: `Missing Judge verdict for criterion=${criterion}`,
      });
    }
    if (matching.length > 1) {
      addError(errors, {
        errorCode: "QUALITY_GATE_DUPLICATE_CRITERION",
        criterion,
        message: `Duplicate Judge verdict for criterion=${criterion}`,
      });
    }
  }

  for (const verdict of verdicts) {
    if (!isRecord(verdict)) {
      addError(errors, {
        errorCode: "QUALITY_GATE_INPUT_INVALID",
        message: "Judge verdict must be an object",
      });
      continue;
    }
    const criterion = SUMMARY_CRITERIA.includes(
      verdict.criterion as (typeof SUMMARY_CRITERIA)[number],
    )
      ? verdict.criterion as (typeof SUMMARY_CRITERIA)[number]
      : undefined;
    const relation = expectedVerdict(verdict.score);
    if (
      relation === null
      || (
        verdict.score !== null
        && !SUMMARY_JUDGE_SCORE_VALUES.includes(
          verdict.score as (typeof SUMMARY_JUDGE_SCORE_VALUES)[number],
        )
      )
      || verdict.verdict !== relation
    ) {
      addError(errors, {
        errorCode: "QUALITY_GATE_INVALID_SCORE",
        criterion,
        message: `Invalid Judge score/verdict relation for criterion=${criterion ?? "unknown"}`,
      });
    }
    if (!SummaryJudgeV3Schema.safeParse(verdict).success && relation !== null) {
      addError(errors, {
        errorCode: "QUALITY_GATE_INPUT_INVALID",
        criterion,
        message: `Judge verdict does not match summary.judge.verdict.v3@3.1.0 for criterion=${criterion ?? "unknown"}`,
      });
    }
  }
}

function manifestVersionsMatch(manifest: PipelineContractManifest): boolean {
  const expected = {
    conversationStore: [ConversationStoreV3Contract.id, "3.2.0"],
    summary: [SummaryV3Contract.id, "3.1.0"],
    summaryJudges: [SummaryJudgeV3Contract.id, "3.1.0"],
    qualityGateInput: [SummaryQualityGateInputV3Contract.id, "3.0.0"],
    qualityGate: [QualityGateV3Contract.id, "3.2.0"],
  } as const;
  return Object.entries(expected).every(([role, [id, version]]) => {
    const reference = manifest.contracts[role as keyof typeof expected];
    return reference?.id === id && reference.version === version;
  });
}

export function buildSummaryQualityGateInput(input: {
  manifest: PipelineContractManifest;
  conversationStore: unknown;
  summary: unknown;
  verdicts: readonly unknown[];
  policy?: unknown;
}): BuildSummaryQualityGateInputResult {
  const provenance = deriveProvenance(input.manifest, input.conversationStore, input.summary);
  if (input.summary === null || input.summary === undefined) {
    return {
      ok: false,
      disposition: "NOT_RUN",
      errors: [{
        errorCode: "QUALITY_GATE_INPUT_INVALID",
        message: "Summary v3 is missing",
      }],
      provenance,
    };
  }
  if (
    isRecord(input.summary)
    && "status" in input.summary
    && ["technical_error", "error"].includes(String(input.summary.status).toLowerCase())
  ) {
    return {
      ok: false,
      disposition: "NOT_RUN",
      errors: [{
        errorCode: "QUALITY_GATE_INPUT_INVALID",
        message: "Summary v3 ended with a technical error",
      }],
      provenance,
    };
  }

  const errors: SummaryQualityGateInputError[] = [];
  if (!manifestVersionsMatch(input.manifest)) {
    addError(errors, {
      errorCode: "QUALITY_GATE_VERSION_MISMATCH",
      message: "Manifest does not reference the Phase 7 contract set",
    });
  }
  try {
    validateContractManifest(input.manifest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addError(errors, {
      errorCode: /hash/i.test(message)
        ? "QUALITY_GATE_HASH_MISMATCH"
        : "QUALITY_GATE_INPUT_INVALID",
      message,
    });
  }

  const store = ConversationStoreV3Schema.safeParse(input.conversationStore);
  const summary = SummaryV3Schema.safeParse(input.summary);
  if (!store.success || !summary.success) {
    addError(errors, {
      errorCode: "QUALITY_GATE_INPUT_INVALID",
      message: "Store or Summary does not match its typed v3 contract",
    });
  }
  if (store.success) {
    const { content_hash: _contentHash, ...hashableStore } = store.data;
    if (
      calculateConversationStoreContentHash(hashableStore) !== store.data.content_hash
      || store.data.meta.manifest_hash !== input.manifest.manifestHash
    ) {
      addError(errors, {
        errorCode: "QUALITY_GATE_HASH_MISMATCH",
        message: "Conversation Store content or manifest hash mismatch",
      });
    }
  }
  if (store.success && summary.success) {
    if (store.data.meta.contract_version !== "3.2.0") {
      addError(errors, {
        errorCode: "QUALITY_GATE_VERSION_MISMATCH",
        message: "Store or Summary contract version mismatch",
      });
    }
  }

  const verdicts = Array.isArray(input.verdicts) ? input.verdicts : [];
  inspectVerdicts(verdicts, errors);
  const summaryHash = summary.success
    ? calculateSummaryContentHash(summary.data)
    : provenance.summaryHash;
  for (const verdict of verdicts) {
    const parsed = SummaryJudgeV3Schema.safeParse(verdict);
    if (!parsed.success || !store.success) continue;
    if (
      parsed.data.metadata.sourceStoreId !== store.data.meta.store_id
      || parsed.data.metadata.sourceStoreHash !== store.data.content_hash
      || parsed.data.metadata.sourceSummaryHash !== summaryHash
    ) {
      addError(errors, {
        errorCode: "QUALITY_GATE_HASH_MISMATCH",
        criterion: parsed.data.criterion,
        message: `Judge provenance hash mismatch for criterion=${parsed.data.criterion}`,
      });
    }
    if (parsed.data.metadata.contractVersion !== "3.1.0") {
      addError(errors, {
        errorCode: "QUALITY_GATE_VERSION_MISMATCH",
        criterion: parsed.data.criterion,
        message: `Judge contract version mismatch for criterion=${parsed.data.criterion}`,
      });
    }
  }

  const policy = input.policy ?? {
    weights: SUMMARY_QUALITY_GATE_WEIGHTS,
    thresholds: SUMMARY_QUALITY_GATE_THRESHOLDS,
  };
  if (!SummaryQualityGatePolicyV3Schema.safeParse(policy).success) {
    addError(errors, {
      errorCode: "QUALITY_GATE_INVALID_POLICY",
      message: `${SUMMARY_QUALITY_GATE_POLICY_VERSION} policy weights or thresholds are invalid`,
    });
  }
  if (errors.length > 0 || !store.success || !summary.success) {
    return {
      ok: false,
      disposition: "TECHNICAL_ERROR",
      errors,
      provenance: {
        ...provenance,
        ...(store.success ? {
          runId: store.data.meta.run_id,
          storeId: store.data.meta.store_id,
          storeContentHash: store.data.content_hash,
        } : {}),
        summaryHash,
      },
    };
  }

  const candidate = {
    meta: {
      runId: store.data.meta.run_id,
      manifestHash: input.manifest.manifestHash,
      storeId: store.data.meta.store_id,
      storeContentHash: store.data.content_hash,
      summaryHash,
      summaryContractVersion: "3.1.0" as const,
      judgeContractVersion: "3.1.0" as const,
      qualityGatePolicyVersion: SUMMARY_QUALITY_GATE_POLICY_VERSION,
    },
    summary: summary.data,
    verdicts,
    policy,
  };
  const parsed = SummaryQualityGateInputV3Schema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      disposition: "TECHNICAL_ERROR",
      errors: [{
        errorCode: "QUALITY_GATE_INPUT_INVALID",
        message: parsed.error.message,
      }],
      provenance: { ...provenance, summaryHash },
    };
  }
  return {
    ok: true,
    value: parsed.data,
    provenance: {
      runId: parsed.data.meta.runId,
      manifestHash: parsed.data.meta.manifestHash,
      storeId: parsed.data.meta.storeId,
      storeContentHash: parsed.data.meta.storeContentHash,
      summaryHash: parsed.data.meta.summaryHash,
    },
  };
}
