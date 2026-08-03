import type {
  SummaryCriterionV3,
  SummaryJudgeInputV3,
} from "../contracts/summary-judge-input/v3/contract";
import {
  SUMMARY_JUDGE_ISSUE_CODES,
  SUMMARY_JUDGE_SCORE_VALUES,
  SummaryJudgeV3Schema,
  type SummaryJudgeFindingV3,
  type SummaryJudgeV3,
} from "../contracts/summary-judges/v3/contract";

export type SummaryJudgePostValidationResult =
  | Readonly<{ ok: true; value: SummaryJudgeV3 }>
  | Readonly<{
      ok: false;
      error: {
        status: "TECHNICAL_ERROR";
        errorCode: "SUMMARY_JUDGE_OUTPUT_INVALID";
        message: string;
      };
    }>;

function fail(message: string): SummaryJudgePostValidationResult {
  return {
    ok: false,
    error: {
      status: "TECHNICAL_ERROR",
      errorCode: "SUMMARY_JUDGE_OUTPUT_INVALID",
      message,
    },
  };
}

function payloadFindings(value: SummaryJudgeV3): readonly SummaryJudgeFindingV3[] {
  switch (value.payload.criterion) {
    case "faithfulness":
      return [
        ...value.payload.unsupportedClaims,
        ...value.payload.distortedFacts,
        ...value.payload.roleErrors,
        ...value.payload.quoteErrors,
        ...value.payload.attributeMismatches,
      ];
    case "completeness":
      return [
        ...value.payload.missingGoal,
        ...value.payload.missingRequirements,
        ...value.payload.missingConstraints,
        ...value.payload.missingFinancialContext,
        ...value.payload.missingOutcome,
        ...value.payload.missingNextStep,
        ...value.payload.missingCriticalQuestions,
      ];
    case "usefulness":
      return [
        ...value.payload.agentBlockingOmissions,
        ...value.payload.unclearStatements,
        ...value.payload.missingOperationalContext,
        ...value.payload.unnecessaryDetails,
      ];
    case "agreements_next_step":
      return [
        ...value.payload.missingAction,
        ...value.payload.incorrectOwner,
        ...value.payload.incorrectRecipient,
        ...value.payload.incorrectDeadline,
        ...value.payload.incorrectChannel,
        ...value.payload.incorrectStatus,
        ...value.payload.missingNextStep,
        ...value.payload.inventedDetails,
      ];
    case "format":
      return [
        ...value.payload.semanticRepetitions,
        ...value.payload.crmCardDuplications,
        ...value.payload.verbosityIssues,
        ...value.payload.structureIssues,
        ...value.payload.readabilityIssues,
        ...value.payload.technicalFieldLeaks,
      ];
  }
}

function storeItemIds(input: SummaryJudgeInputV3): Set<string> {
  const store = input.conversationStore;
  const collections = [
    store.facts,
    store.quotes,
    store.requirements,
    Array.isArray(store.attributes.interested_in)
      ? store.attributes.interested_in
      : [],
    store.attributes.funding_source
      ? [store.attributes.funding_source]
      : [],
    store.attributes.purchase_term
      ? [store.attributes.purchase_term]
      : [],
    store.agreements,
  ];
  return new Set(collections.flat().flatMap((item) =>
    item && typeof item === "object" && "id" in item && typeof item.id === "string"
      ? [item.id]
      : []));
}

function expectedVerdict(score: SummaryJudgeV3["score"]): SummaryJudgeV3["verdict"] {
  if (score === null) return "technical_error";
  if (score === 100) return "pass";
  if (score === 75) return "warning";
  return "fail";
}

function attributeValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(attributeValue).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return attributeValue(item.value ?? item.normalized_value ?? "");
  }
  return typeof value === "string" ? value.trim() : "";
}

function applyCompletenessCrmCoverage(
  input: SummaryJudgeInputV3,
  value: SummaryJudgeV3,
): SummaryJudgeV3 {
  if (value.criterion !== "completeness") return value;
  const attributes = input.conversationStore.attributes as Record<string, unknown>;
  const covered = [
    ["funding_source", attributes.funding_source, /funding|источник|средств|оплат|наличн|депозит|ипотек/iu],
    ["purchase_term", attributes.purchase_term, /purchase.?term|срок|покупк/iu],
    ["interest", attributes.interested_in ?? attributes.interest, /interest|интерес|объект|квартир/iu],
  ] as const;
  const coveredIds = new Set<string>();
  const coveredPatterns: RegExp[] = [];
  for (const [name, raw, pattern] of covered) {
    const rendered = attributeValue(raw).toLocaleLowerCase("ru-RU");
    if (!rendered || rendered === "не определено" || rendered === "not_defined") continue;
    coveredPatterns.push(pattern);
    const values = Array.isArray(raw) ? raw : [raw];
    values.forEach((item) => {
      if (item && typeof item === "object" && "id" in item && typeof item.id === "string") coveredIds.add(item.id);
    });
    coveredIds.add(name);
  }
  if (!coveredPatterns.length) return value;
  const coveredFinding = (finding: SummaryJudgeFindingV3) =>
    finding.storeItemIds?.some((itemId) => coveredIds.has(itemId)) === true
    || coveredPatterns.some((pattern) => pattern.test(`${finding.message} ${finding.summaryFragment ?? ""}`));
  const removed = value.payload.missingFinancialContext.filter(coveredFinding);
  if (!removed.length) return value;
  const removedKeys = new Set(removed.map((item) => `${item.code}\u0000${item.message}`));
  const payload = {
    ...value.payload,
    missingFinancialContext: value.payload.missingFinancialContext.filter((item) => !coveredFinding(item)),
  };
  const issues = value.issues.filter((item) => !removedKeys.has(`${item.code}\u0000${item.message}`));
  const candidate = { ...value, payload, issues } as SummaryJudgeV3;
  if (payloadFindings(candidate).length || issues.length) return candidate;
  return { ...candidate, score: 100, verdict: "pass" } as SummaryJudgeV3;
}

export function validateSummaryJudgeVerdict(
  input: SummaryJudgeInputV3,
  criterion: SummaryCriterionV3,
  output: unknown,
): SummaryJudgePostValidationResult {
  const parsed = SummaryJudgeV3Schema.safeParse(output);
  if (!parsed.success) return fail(parsed.error.message);
  const value = applyCompletenessCrmCoverage(input, parsed.data);
  if (
    value.criterion !== criterion
    || value.payload.criterion !== criterion
    || input.meta.judgeCriterion !== criterion
  ) {
    return fail("Judge criterion does not match its stage or payload");
  }
  if (
    !SUMMARY_JUDGE_SCORE_VALUES.includes(
      value.score as (typeof SUMMARY_JUDGE_SCORE_VALUES)[number],
    ) && value.score !== null
  ) {
    return fail("Judge score is outside the discrete scale");
  }
  if (
    value.verdict !== expectedVerdict(value.score)
    || (value.verdict === "technical_error" && value.confidence !== null)
    || (value.verdict !== "technical_error" && value.confidence === null)
  ) {
    return fail("Judge verdict, score and confidence are inconsistent");
  }
  if (
    value.metadata.sourceStoreId !== input.meta.storeId
    || value.metadata.sourceStoreHash !== input.meta.storeContentHash
    || value.metadata.sourceSummaryHash !== input.meta.summaryHash
    || value.metadata.contractVersion !== "3.1.0"
    || value.metadata.promptVersion !== input.meta.judgePromptVersion
  ) {
    return fail("Judge output source metadata does not match typed input");
  }

  const allowedCodes = new Set<string>(SUMMARY_JUDGE_ISSUE_CODES[criterion]);
  const findings = [...value.issues, ...payloadFindings(value)];
  if (findings.some((finding) => !allowedCodes.has(finding.code))) {
    return fail(`Judge output contains an issue code outside criterion=${criterion}`);
  }

  const turnIds = new Set(input.transcriptContext.turns.map((turn) => turn.turnId));
  const itemIds = storeItemIds(input);
  const referenced = [
    ...findings,
    ...value.evidence,
  ];
  for (const entry of referenced) {
    if (entry.sourceTurnIds?.some((sourceId) => !turnIds.has(sourceId))) {
      return fail("Judge output references an unknown transcript turn");
    }
    if (entry.storeItemIds?.some((itemId) => !itemIds.has(itemId))) {
      return fail("Judge output references an unknown Store item");
    }
  }
  return { ok: true, value };
}
