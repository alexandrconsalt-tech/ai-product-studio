import type { z } from "zod";
import type { FactJudgeV3 } from "../contracts/fact-judge/v3/contract";
import type { FactsVerifiedV3 } from "../contracts/facts-verified/v3/contract";
import { FactsVerifiedV3Schema } from "../contracts/facts-verified/v3/contract";
import type { FactsV3 } from "../contracts/facts/v3/contract";
import type { NeedJudgeV3 } from "../contracts/need-judge/v3/contract";
import type { NeedsVerifiedV3 } from "../contracts/needs-verified/v3/contract";
import { NeedsVerifiedV3Schema } from "../contracts/needs-verified/v3/contract";
import type { NeedsV3 } from "../contracts/needs/v3/contract";
import type { OutcomeJudgeV3 } from "../contracts/outcome-judge/v3/contract";
import type { OutcomeVerifiedV3 } from "../contracts/outcome-verified/v3/contract";
import { OutcomeVerifiedV3Schema } from "../contracts/outcome-verified/v3/contract";
import type { OutcomeV3 } from "../contracts/outcome/v3/contract";
import { stableStringify } from "../contracts/schema-utils";
import type { SourceReferenceSchema, VerdictTrailEntrySchema } from "../contracts/shared-schemas";

type SourceReference = z.infer<typeof SourceReferenceSchema>;
type VerdictTrailEntry = z.infer<typeof VerdictTrailEntrySchema>;
type JudgeItem = FactJudgeV3["items"][number];
type RejectionReason = "rejected" | "not_enough_evidence" | "technical_error" | "invariant_violation" | "deduplicated";
type Candidate = Record<string, unknown> & {
  id: string;
  source_turn_ids?: string[];
  source_turn_id?: string;
  confidence?: number;
  evidence?: string;
};

export type ReconciliationError = Readonly<{
  status: "TECHNICAL_ERROR";
  errorCode: "JUDGE_TECHNICAL_ERROR" | "RECONCILIATION_INVARIANT_FAILED";
  message: string;
}>;

export type ReconciliationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: ReconciliationError }>;

type ReconciledItem = Readonly<{
  candidate: Candidate | null;
  trail: VerdictTrailEntry;
  rejection: { item_id: string; reason: RejectionReason } | null;
}>;

function candidateSourceIds(candidate: Candidate): string[] {
  return candidate.source_turn_ids ?? (candidate.source_turn_id ? [candidate.source_turn_id] : []);
}

function applyAllowedCorrections(
  candidate: Candidate,
  verdict: JudgeItem,
  sourceIds: ReadonlySet<string>,
  wordingField?: string,
): { value: Candidate; correction: JudgeItem["corrections"][number] | null; invariant: string | null } {
  let value = { ...candidate };
  let applied: JudgeItem["corrections"][number] | null = null;
  for (const correction of verdict.corrections) {
    if (correction.source_turn_ids?.some((sourceId) => !sourceIds.has(sourceId))) {
      return { value, correction, invariant: "correction references an unknown source ID" };
    }
    if (correction.wording && !wordingField) {
      return { value, correction, invariant: "wording correction is not allowed for this item kind" };
    }
    value = {
      ...value,
      ...(correction.confidence === undefined ? {} : { confidence: correction.confidence }),
      ...(correction.source_turn_ids === undefined ? {} : { source_turn_ids: correction.source_turn_ids }),
      ...(correction.evidence === undefined ? {} : { evidence: correction.evidence }),
      ...(correction.wording === undefined || !wordingField ? {} : { [wordingField]: correction.wording }),
    };
    applied = correction;
  }
  return { value, correction: applied, invariant: null };
}

function reconcileCandidates(
  candidates: readonly Candidate[],
  judge: { items: readonly JudgeItem[] },
  sourceReferences: readonly SourceReference[],
  wordingFields: Readonly<Record<string, string | undefined>>,
  dedupeGroups: Readonly<Record<string, string>>,
): ReconciliationResult<readonly ReconciledItem[]> {
  const sourceIds = new Set(sourceReferences.map((source) => source.turn_id));
  const candidateById = new Map<string, Candidate>();
  for (const candidate of candidates) {
    if (candidateById.has(candidate.id)) {
      return { ok: false, error: { status: "TECHNICAL_ERROR", errorCode: "RECONCILIATION_INVARIANT_FAILED", message: `duplicate agent item ID: ${candidate.id}` } };
    }
    if (candidateSourceIds(candidate).some((sourceId) => !sourceIds.has(sourceId))) {
      return { ok: false, error: { status: "TECHNICAL_ERROR", errorCode: "RECONCILIATION_INVARIANT_FAILED", message: `unknown source ID in agent item: ${candidate.id}` } };
    }
    candidateById.set(candidate.id, candidate);
  }

  const judgeById = new Map<string, JudgeItem>();
  for (const item of judge.items) {
    if (!candidateById.has(item.item_id) || judgeById.has(item.item_id)) {
      return { ok: false, error: { status: "TECHNICAL_ERROR", errorCode: "RECONCILIATION_INVARIANT_FAILED", message: `invalid Judge item reference: ${item.item_id}` } };
    }
    if (item.evidence_turn_ids.some((sourceId) => !sourceIds.has(sourceId))) {
      return { ok: false, error: { status: "TECHNICAL_ERROR", errorCode: "RECONCILIATION_INVARIANT_FAILED", message: `unknown source ID in Judge verdict: ${item.item_id}` } };
    }
    judgeById.set(item.item_id, item);
  }

  const dedupeKeys = new Set<string>();
  const reconciled: ReconciledItem[] = [];
  for (const candidate of candidates) {
    const verdict = judgeById.get(candidate.id);
    if (!verdict) {
      return { ok: false, error: { status: "TECHNICAL_ERROR", errorCode: "RECONCILIATION_INVARIANT_FAILED", message: `missing Judge verdict: ${candidate.id}` } };
    }
    const corrected = applyAllowedCorrections(candidate, verdict, sourceIds, wordingFields[candidate.id]);
    let finalVerdict: VerdictTrailEntry["final_verdict"] = verdict.verdict === "needs_correction"
      ? "invariant_violation"
      : verdict.verdict;
    let ruleId = `reconcile.${verdict.verdict}.v1`;
    let invariantResult: VerdictTrailEntry["invariant_result"] = "passed";
    let finalCandidate: Candidate | null = null;

    if (corrected.invariant) {
      finalVerdict = "invariant_violation";
      ruleId = "reconcile.correction-invariant.v1";
      invariantResult = "failed";
    } else if (verdict.verdict === "verified" || verdict.verdict === "needs_correction") {
      const withStatus = { ...corrected.value, verification_status: "verified" };
      const dedupeKey = `${dedupeGroups[candidate.id] ?? "default"}:${stableStringify(Object.fromEntries(
        Object.entries(withStatus).filter(([key]) => !["id", "confidence", "verification_status"].includes(key)),
      ))}`;
      if (dedupeKeys.has(dedupeKey)) {
        finalVerdict = "deduplicated";
        ruleId = "reconcile.formal-dedupe.v1";
      } else {
        dedupeKeys.add(dedupeKey);
        finalVerdict = "verified";
        finalCandidate = withStatus;
      }
    }

    reconciled.push({
      candidate: finalCandidate,
      rejection: finalCandidate ? null : { item_id: candidate.id, reason: finalVerdict as RejectionReason },
      trail: {
        item_id: candidate.id,
        agent_value: JSON.parse(JSON.stringify(candidate)) as VerdictTrailEntry["agent_value"],
        judge_verdict: verdict.verdict,
        applied_correction: corrected.correction,
        invariant_result: invariantResult,
        final_verdict: finalVerdict,
        rule_id: ruleId,
      },
    });
  }
  return { ok: true, value: reconciled };
}

function metadata(sourceContractId: string, judgeContractId: string, reconciledAt: string) {
  return {
    reconciliation_status: "completed" as const,
    reconciled_at: reconciledAt,
    source_contract_id: sourceContractId,
    judge_contract_id: judgeContractId,
  };
}

export function reconcileFactsV3(
  agent: FactsV3,
  judge: FactJudgeV3 | null,
  sourceReferences: readonly SourceReference[],
  reconciledAt: string,
): ReconciliationResult<FactsVerifiedV3> {
  if (!judge) return { ok: false, error: { status: "TECHNICAL_ERROR", errorCode: "JUDGE_TECHNICAL_ERROR", message: "Fact Judge did not return a typed verdict" } };
  const candidates = [
    ...agent.confirmed_facts,
    ...agent.client_questions,
    ...agent.quotes,
    ...agent.contextual_statements,
    ...agent.rejected_assumptions,
  ];
  const fields = Object.fromEntries([
    ...agent.client_questions.map((item) => [item.id, "question"]),
    ...agent.quotes.map((item) => [item.id, "text"]),
    ...agent.contextual_statements.map((item) => [item.id, "statement"]),
    ...agent.rejected_assumptions.map((item) => [item.id, "statement"]),
  ]);
  const groups = Object.fromEntries([
    ...agent.confirmed_facts.map((item) => [item.id, "facts"]),
    ...agent.client_questions.map((item) => [item.id, "questions"]),
    ...agent.quotes.map((item) => [item.id, "quotes"]),
    ...agent.contextual_statements.map((item) => [item.id, "context"]),
    ...agent.rejected_assumptions.map((item) => [item.id, "assumptions"]),
  ]);
  const result = reconcileCandidates(candidates, judge, sourceReferences, fields, groups);
  if (!result.ok) return result;
  const byId = new Map(result.value.map((item) => [item.trail.item_id, item]));
  const verified = {
    verified_facts: agent.confirmed_facts.flatMap((item) => byId.get(item.id)?.candidate ? [byId.get(item.id)!.candidate] : []),
    verified_quotes: agent.quotes.flatMap((item) => {
      const candidate = byId.get(item.id)?.candidate;
      if (!candidate) return [];
      const { source_turn_ids: _sourceIds, ...quote } = candidate;
      return [quote];
    }),
    verified_client_questions: agent.client_questions.flatMap((item) => byId.get(item.id)?.candidate ? [byId.get(item.id)!.candidate] : []),
    rejected_item_references: result.value.flatMap((item) => item.rejection ? [item.rejection] : []),
    source_references: sourceReferences,
    verdict_trail: result.value.map((item) => item.trail),
    technical_metadata: metadata("facts.agent.output.v3", "facts.judge.verdict.v3", reconciledAt),
  };
  const parsed = FactsVerifiedV3Schema.safeParse(verified);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: { status: "TECHNICAL_ERROR", errorCode: "RECONCILIATION_INVARIANT_FAILED", message: parsed.error.message } };
}

export function reconcileNeedsV3(
  agent: NeedsV3,
  judge: NeedJudgeV3 | null,
  sourceReferences: readonly SourceReference[],
  reconciledAt: string,
): ReconciliationResult<NeedsVerifiedV3> {
  if (!judge) return { ok: false, error: { status: "TECHNICAL_ERROR", errorCode: "JUDGE_TECHNICAL_ERROR", message: "Need Judge did not return a typed verdict" } };
  const candidates = [
    ...agent.business_needs,
    ...agent.property_requirements,
    ...agent.structured_crm_attributes.interested_in,
    agent.structured_crm_attributes.funding_source,
    agent.structured_crm_attributes.purchase_term,
    ...agent.communication_preferences,
    ...agent.client_questions,
  ];
  const fields = Object.fromEntries([
    ...agent.business_needs.map((item) => [item.id, "evidence"]),
    ...agent.property_requirements.map((item) => [item.id, "evidence"]),
    ...agent.client_questions.map((item) => [item.id, "question"]),
  ]);
  const groups = Object.fromEntries([
    ...agent.business_needs.map((item) => [item.id, "business-needs"]),
    ...agent.property_requirements.map((item) => [item.id, "property-requirements"]),
    ...agent.structured_crm_attributes.interested_in.map((item) => [item.id, "interest"]),
    [agent.structured_crm_attributes.funding_source.id, "funding"],
    [agent.structured_crm_attributes.purchase_term.id, "term"],
    ...agent.communication_preferences.map((item) => [item.id, "communication"]),
    ...agent.client_questions.map((item) => [item.id, "questions"]),
  ]);
  const result = reconcileCandidates(candidates, judge, sourceReferences, fields, groups);
  if (!result.ok) return result;
  const byId = new Map(result.value.map((item) => [item.trail.item_id, item]));
  const take = <T extends { id: string }>(items: readonly T[]) => items.flatMap((item) => byId.get(item.id)?.candidate ? [byId.get(item.id)!.candidate] : []);
  const verified = {
    verified_business_needs: take(agent.business_needs),
    verified_property_requirements: take(agent.property_requirements),
    verified_structured_crm_attributes: {
      interested_in: take(agent.structured_crm_attributes.interested_in),
      funding_source: byId.get(agent.structured_crm_attributes.funding_source.id)?.candidate ?? null,
      purchase_term: byId.get(agent.structured_crm_attributes.purchase_term.id)?.candidate ?? null,
    },
    verified_communication_preferences: take(agent.communication_preferences),
    verified_client_questions: take(agent.client_questions),
    rejected_item_references: result.value.flatMap((item) => item.rejection ? [item.rejection] : []),
    source_references: sourceReferences,
    verdict_trail: result.value.map((item) => item.trail),
    technical_metadata: metadata("needs.agent.output.v3", "needs.judge.verdict.v3", reconciledAt),
  };
  const parsed = NeedsVerifiedV3Schema.safeParse(verified);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: { status: "TECHNICAL_ERROR", errorCode: "RECONCILIATION_INVARIANT_FAILED", message: parsed.error.message } };
}

export function reconcileOutcomeV3(
  _agent: OutcomeV3,
  _judge: OutcomeJudgeV3 | null,
  _sourceReferences: readonly SourceReference[],
  _reconciledAt: string,
): ReconciliationResult<OutcomeVerifiedV3> {
  return {
    ok: false,
    error: {
      status: "TECHNICAL_ERROR",
      errorCode: "JUDGE_TECHNICAL_ERROR",
      message: "Outcome reconciliation is removed from the active pipeline",
    },
  };
}
