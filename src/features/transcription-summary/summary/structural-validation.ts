import type { SummaryV3 } from "../contracts/summary/v3/contract";
import type { SummaryPlanMeaning, SummaryPlanV3 } from "./summary-plan";

export type SummaryStructuralTransformation = Readonly<{
  ruleId:
    | "summary.required-meaning-restored.v1"
    | "summary.exclusive-next-step.v1"
    | "summary.protected-value-restored.v1"
    | "summary.technical-residue-removed.v1"
    | "summary.plan-block-enforced.v1"
    | "summary.invalid-quote-removed.v1";
  fieldPath: string;
  meaningId: string | null;
  reason: string;
}>;

export type SummaryFinalDiagnosticsV3 = Readonly<{
  requiredMeaningIds: readonly string[];
  missingMeaningIds: readonly string[];
  duplicatedMeaningIds: readonly string[];
  protectedValueViolations: readonly string[];
  technicalResidue: readonly string[];
  nextStepDuplicationCount: number;
}>;

export type StructuralValidationResult = Readonly<{
  ok: true;
  value: SummaryV3;
  status: "unchanged" | "transformed";
  transformations: readonly SummaryStructuralTransformation[];
  diagnostics: SummaryFinalDiagnosticsV3;
}> | Readonly<{
  ok: false;
  error: string;
  transformations: readonly SummaryStructuralTransformation[];
  diagnostics: SummaryFinalDiagnosticsV3;
}>;

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/\s+/gu, " ").trim();
}

function tokens(value: string): readonly string[] {
  return normalized(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function overlap(left: string, right: string): number {
  const a = new Set(tokens(left).filter((item) => item.length > 2));
  const b = new Set(tokens(right).filter((item) => item.length > 2));
  if (!a.size || !b.size) return normalized(left) === normalized(right) ? 1 : 0;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function technicalResidue(value: string): readonly string[] {
  const result: string[] = [];
  if (/```|[{}\[\]]|"(?:status|error|message|code)"\s*:/iu.test(value)) result.push("JSON_FRAGMENT");
  if (/(?:^|\s)(?:error|technical_error)(?:\s|$)/iu.test(value)) result.push("TECHNICAL_ERROR_TOKEN");
  return [...new Set(result)];
}

function protectedTokens(value: string): readonly string[] {
  const patterns = [
    /(?<![\p{L}\p{N}])\d{1,2}:\d{2}(?![\p{L}\p{N}])/gu,
    /(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?\s*(?:м²|кв\.?\s*м(?:етр(?:а|ов)?)?|руб(?:лей|ля)?|₽|млн|миллион(?:а|ов)?|тыс(?:яч)?)(?![\p{L}\p{N}])/giu,
    /(?<![\p{L}\p{N}])(?:сегодня|завтра|послезавтра|понедельник|вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресенье)(?![\p{L}\p{N}])/giu,
    /(?<![\p{L}\p{N}])(?:телефон|почт[аеу]|email|e-mail|whatsapp|telegram|смс|звонок|перезвон)(?![\p{L}\p{N}])/giu,
  ];
  return [...new Set(patterns.flatMap((pattern) => value.match(pattern) ?? []).map(normalized))];
}

function hasNegation(value: string): boolean {
  return /(?:^|\s)(?:не|нет|без|нельзя|исключает|отказывается)(?:\s|$)/iu.test(normalized(value));
}

function protectedPresent(actual: string, expected: string): boolean {
  const value = normalized(actual);
  if (expected === "email" || expected === "e-mail") return /(?:email|e-mail|электронн\S* почт)/iu.test(value);
  if (expected === "phone" || expected === "телефон") return /(?:phone|телефон|звон)/iu.test(value);
  return value.includes(expected);
}

function meaningCovered(summary: SummaryV3, meaning: SummaryPlanMeaning): boolean {
  const blockText = meaning.block === "conversation_result"
    ? summary.conversation_result
    : meaning.block === "key_facts"
      ? summary.key_facts.map((item) => `${item.label} ${item.value}`).join(" ")
      : meaning.block === "next_step"
        ? summary.next_step
        : summary.quotes.map((item) => item.text).join(" ");
  if (protectedTokens(meaning.text).some((item) => !protectedPresent(blockText, item))) return false;
  if (hasNegation(meaning.text) && !hasNegation(blockText)) return false;
  return overlap(blockText, meaning.text) >= 0.5 || normalized(blockText).includes(normalized(meaning.text));
}

function label(meaning: SummaryPlanMeaning): string {
  if (meaning.kind === "client_goal") return "Цель клиента";
  if (/(?:бюджет|руб|₽|млн|миллион)/iu.test(meaning.text)) return "Бюджет";
  if (/(?:ипотек|финанс|сбербанк|наличн|депозит)/iu.test(meaning.text)) return "Финансирование";
  if (/(?:срок|месяц)/iu.test(meaning.text)) return "Срок покупки";
  return /(?:возраж|сомнен|не рассматрива|огранич)/iu.test(meaning.text) ? "Ограничение" : "Ключевой факт";
}

function renderConversationResult(meanings: readonly SummaryPlanMeaning[]): string {
  const result = meanings.map((item) => item.text.replace(/[.!?\s]+$/u, "")).filter(Boolean).join(". ");
  return result ? `${result}.` : "Результат разговора не определён.";
}

function exactNextStepDuplicated(conversationResult: string, nextStep: string): boolean {
  const exact = normalized(nextStep).replace(/[.!?]+$/u, "");
  const result = normalized(conversationResult);
  if (exact.length >= 10 && result.includes(exact)) return true;
  const details = protectedTokens(nextStep);
  if (!details.length || !details.every((item) => result.includes(item))) return false;
  const actionFamilies = [
    /(?:отправ|пришл|направ|подбор)/u,
    /(?:позвон|перезвон|созвон)/u,
    /(?:встрет|приех|просмотр)/u,
    /(?:показ|демонстр)/u,
  ];
  if (details.length >= 2 && actionFamilies.some((pattern) => pattern.test(result) && pattern.test(normalized(nextStep)))) {
    return true;
  }
  return overlap(result, nextStep) >= (details.length >= 2 ? 0.45 : 0.75);
}

const NEXT_STEP_ACTION_FAMILIES = [
  /(?:отправ|пришл|направ|переда|предостав|подготов|подбор|подбер|предлож|вариант)/u,
  /(?:позвон|перезвон|созвон|связ|контакт)/u,
  /(?:встреч|встрет|приед|приех|прибы|осмотр|просмотр)/u,
  /(?:показ|демонстр)/u,
] as const;

function sharedNextStepAction(value: string, nextStep: string): boolean {
  const actual = normalized(value);
  const expected = normalized(nextStep);
  return NEXT_STEP_ACTION_FAMILIES.some((pattern) => pattern.test(actual) && pattern.test(expected));
}

function isAllowedCompactOutcome(value: string, nextStep: string): boolean {
  return normalized(value).replace(/[.!?]+$/u, "")
    === normalized(compactConversationResult(nextStep)).replace(/[.!?]+$/u, "");
}

function containsNextStepDetail(value: string, nextStep: string): boolean {
  if (isAllowedCompactOutcome(value, nextStep)) return false;
  if (exactNextStepDuplicated(value, nextStep)) return true;
  if (!sharedNextStepAction(value, nextStep)) return false;
  return /(?:агент|менеджер|риелтор|договор|соглас|подтверд|следующ|обязал|(?<![\p{L}\p{N}])(?:завтра|сегодня|утром|вечером|max)(?![\p{L}\p{N}])|\d{1,2}:\d{2}|электронн\S*\s+почт|telegram|whatsapp)/iu.test(normalized(value));
}

function enforceExclusiveNextStep(conversationResult: string, nextStep: string): Readonly<{ value: string; changed: boolean }> {
  const sentences = conversationResult
    .replace(/([.;])\s+(?=(?:агент|менеджер|риелтор)(?![\p{L}\p{N}]))/giu, "$1\n")
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const kept = sentences.filter((sentence) => !containsNextStepDetail(sentence, nextStep));
  if (kept.length === sentences.length) return { value: conversationResult.trim(), changed: false };
  const compact = compactConversationResult(nextStep);
  if (!kept.some((sentence) => isAllowedCompactOutcome(sentence, nextStep))) kept.push(compact);
  return { value: kept.join(" ").trim(), changed: true };
}

function negativeStatements(value: string): readonly string[] {
  return value
    .split(/(?<=[.!?;])\s+|,\s+/u)
    .map((part) => part.trim().replace(/[.!?;\s]+$/u, ""))
    .filter((part) => part.length > 0 && hasNegation(part));
}

function nextStepDuplicatedInText(conversationResult: string, nextStep: string): boolean {
  return conversationResult
    .replace(/([.;])\s+(?=(?:агент|менеджер|риелтор)(?![\p{L}\p{N}]))/giu, "$1\n")
    .split(/(?<=[.!?])\s+|\n+/u)
    .some((sentence) => containsNextStepDetail(sentence, nextStep));
}

function compactConversationResult(nextStep: string): string {
  const value = normalized(nextStep);
  if (/(?:осмотр|просмотр|встреч|встрет)/u.test(value)) return "Просмотр согласован.";
  if (/(?:документ)/u.test(value)) return "Отправка документов согласована.";
  if (/(?:перезвон|повторн\S* звон|позвон)/u.test(value)) return "Договорились о повторном звонке.";
  if (/(?:подбор|вариант)/u.test(value)) return "Отправка подборки согласована.";
  if (/(?:видео|материал|планиров)/u.test(value)) return "Отправка материалов согласована.";
  return "Следующий шаг согласован.";
}

function protectedValueStatement(value: string): string {
  if (/(?:руб|₽|млн|миллион|тыс)/u.test(value)) return `Бюджет: ${value}.`;
  if (/(?:м2|м²|кв\. м)/u.test(value)) return `Площадь: ${value}.`;
  return `Ключевое значение: ${value}.`;
}

function meaningDuplicatesNextStep(meaning: SummaryPlanMeaning, nextMeaning: SummaryPlanMeaning | undefined): boolean {
  if (!nextMeaning || meaning.meaningId === nextMeaning.meaningId) return false;
  return exactNextStepDuplicated(meaning.text, nextMeaning.text)
    || overlap(meaning.text, nextMeaning.text) >= 0.8;
}

function meaningCoveredWithExclusiveNextStep(
  summary: SummaryV3,
  meaning: SummaryPlanMeaning,
  nextMeaning: SummaryPlanMeaning | undefined,
): boolean {
  if (meaningCovered(summary, meaning)) return true;
  if (!nextMeaning || meaning.block !== "conversation_result") return false;
  if (meaning.kind === "conversation_result"
    && sharedNextStepAction(meaning.text, nextMeaning.text)
    && summary.conversation_result
      .split(/(?<=[.!?])\s+/u)
      .some((sentence) => isAllowedCompactOutcome(sentence, nextMeaning.text))) {
    return true;
  }
  const nextProtected = new Set(protectedTokens(nextMeaning.text));
  const sharesExclusiveDetail = protectedTokens(meaning.text).some((item) => nextProtected.has(item));
  return sharesExclusiveDetail && overlap(summary.conversation_result, meaning.text) >= 0.5;
}

export function applySummaryPlanAndValidate(
  generated: SummaryV3,
  plan: SummaryPlanV3,
): StructuralValidationResult {
  const transformations: SummaryStructuralTransformation[] = [];
  const requiredResult = plan.meanings.filter((item) => item.required && item.block === "conversation_result");
  const required = plan.meanings.filter((item) => item.required);
  const plannedFacts = plan.meanings.filter((item) => item.block === "key_facts");
  const plannedQuotes = plan.meanings.filter((item) => item.block === "quotes");
  const nextMeaning = plan.meanings.find((item) => item.block === "next_step");
  let conversationResult = generated.conversation_result.trim();

  if (technicalResidue(conversationResult).length) {
    conversationResult = renderConversationResult(requiredResult);
    transformations.push({
      ruleId: "summary.technical-residue-removed.v1",
      fieldPath: "conversation_result",
      meaningId: null,
      reason: "Generated conversation result contained JSON or a technical error token.",
    });
  }
  if (nextMeaning && nextStepDuplicatedInText(conversationResult, nextMeaning.text)) {
    conversationResult = enforceExclusiveNextStep(conversationResult, nextMeaning.text).value;
    transformations.push({
      ruleId: "summary.exclusive-next-step.v1",
      fieldPath: "conversation_result",
      meaningId: nextMeaning.meaningId,
      reason: "Exact primary next step details are exclusive to next_step.",
    });
  }

  let candidate: SummaryV3 = {
    conversation_result: conversationResult,
    key_facts: plannedFacts.length
      ? plannedFacts.map((item) => ({ label: label(item), value: item.text }))
      : generated.key_facts.filter((item) => technicalResidue(`${item.label} ${item.value}`).length === 0),
    quotes: plannedQuotes.map((item) => ({ text: item.text })),
    next_step: nextMeaning
      && technicalResidue(generated.next_step).length === 0
      && overlap(generated.next_step, nextMeaning.text) >= 0.5
      && protectedTokens(nextMeaning.text).every((item) => protectedPresent(generated.next_step, item))
      && (!hasNegation(nextMeaning.text) || hasNegation(generated.next_step))
      ? generated.next_step
      : nextMeaning?.text ?? generated.next_step,
  };
  if (plannedFacts.length && JSON.stringify(candidate.key_facts) !== JSON.stringify(generated.key_facts)) {
    transformations.push({ ruleId: "summary.plan-block-enforced.v1", fieldPath: "key_facts", meaningId: null, reason: "Key facts were rendered from meaning IDs in Summary Plan." });
  }
  if (JSON.stringify(candidate.quotes) !== JSON.stringify(generated.quotes)) {
    transformations.push({ ruleId: "summary.plan-block-enforced.v1", fieldPath: "quotes", meaningId: null, reason: "Quotes were rendered only from quote meanings selected by Summary Plan." });
  }
  if (nextMeaning && normalized(generated.next_step) !== normalized(nextMeaning.text)) {
    transformations.push({ ruleId: "summary.protected-value-restored.v1", fieldPath: "next_step", meaningId: nextMeaning.meaningId, reason: "Primary next step was restored from its canonical meaning." });
  }

  for (const meaning of requiredResult) {
    if (meaningDuplicatesNextStep(meaning, nextMeaning)) continue;
    if (meaningCoveredWithExclusiveNextStep(candidate, meaning, nextMeaning)) continue;
    const suffix = meaning.text.replace(/[.!?\s]+$/u, "");
    candidate = { ...candidate, conversation_result: `${candidate.conversation_result.replace(/\s+$/u, "")} ${suffix}.`.trim() };
    transformations.push({ ruleId: "summary.required-meaning-restored.v1", fieldPath: "conversation_result", meaningId: meaning.meaningId, reason: "Required meaning was missing after generation and was restored from canonical context." });
  }

  if (nextMeaning && nextStepDuplicatedInText(candidate.conversation_result, candidate.next_step)) {
    candidate = {
      ...candidate,
      conversation_result: enforceExclusiveNextStep(candidate.conversation_result, candidate.next_step).value,
    };
    transformations.push({
      ruleId: "summary.exclusive-next-step.v1",
      fieldPath: "conversation_result",
      meaningId: nextMeaning.meaningId,
      reason: "A paraphrased primary next step duplicate introduced during required-meaning repair was removed.",
    });
  }


  const nextProtected = new Set(nextMeaning ? protectedTokens(nextMeaning.text) : []);
  for (const meaning of requiredResult) {
    const missingProtected = protectedTokens(meaning.text)
      .filter((item) => !nextProtected.has(item))
      .filter((item) => !protectedPresent(candidate.conversation_result, item));
    if (!missingProtected.length) continue;
    candidate = {
      ...candidate,
      conversation_result: `${candidate.conversation_result.trim()} ${missingProtected.map(protectedValueStatement).join(" ")}`.trim(),
    };
    transformations.push({
      ruleId: "summary.protected-value-restored.v1",
      fieldPath: "conversation_result",
      meaningId: meaning.meaningId,
      reason: "Non-next-step protected values were restored after exclusive next-step repair.",
    });
  }

  const negationCoveredByDedicatedFact = required.some((item) => item.block === "key_facts" && hasNegation(item.text));
  if (!negationCoveredByDedicatedFact && !hasNegation(candidate.conversation_result)) {
    const restoredNegations = requiredResult.flatMap((meaning) => negativeStatements(meaning.text));
    if (restoredNegations.length) {
      candidate = {
        ...candidate,
        conversation_result: `${candidate.conversation_result.trim()} ${restoredNegations.map((item) => `${item}.`).join(" ")}`.trim(),
      };
      transformations.push({
        ruleId: "summary.protected-value-restored.v1",
        fieldPath: "conversation_result",
        meaningId: requiredResult.find((meaning) => negativeStatements(meaning.text).length)?.meaningId ?? null,
        reason: "A canonical negative constraint was restored after exclusive next-step repair.",
      });
    }
  }

  if (nextMeaning) {
    const exclusive = enforceExclusiveNextStep(candidate.conversation_result, candidate.next_step);
    if (exclusive.changed) {
      candidate = { ...candidate, conversation_result: exclusive.value };
      transformations.push({
        ruleId: "summary.exclusive-next-step.v1",
        fieldPath: "conversation_result",
        meaningId: nextMeaning.meaningId,
        reason: "Exclusive next-step details restored by protected-value repair were removed from conversation_result.",
      });
    }
  }

  const missingMeaningIds = required
    .filter((item) => !meaningCoveredWithExclusiveNextStep(candidate, item, nextMeaning) && !meaningDuplicatesNextStep(item, nextMeaning))
    .map((item) => item.meaningId);
  const duplicatedMeaningIds = plan.meanings.filter((meaning) => meaning.exclusive && (() => {
    const blocks = (["conversation_result", "key_facts", "next_step", "quotes"] as const).filter((block) => {
      if (block === meaning.block) return false;
      const blockText = block === "conversation_result" ? candidate.conversation_result
        : block === "key_facts" ? candidate.key_facts.map((item) => item.value).join(" ")
          : block === "next_step" ? candidate.next_step : candidate.quotes.map((item) => item.text).join(" ");
      return overlap(blockText, meaning.text) >= 0.8 && normalized(blockText).includes(normalized(meaning.text));
    });
    return blocks.length > 0;
  })()).map((item) => item.meaningId);
  const allText = [candidate.conversation_result, ...candidate.key_facts.flatMap((item) => [item.label, item.value]), ...candidate.quotes.map((item) => item.text), candidate.next_step].join(" ");
  const protectedValueViolations = required.flatMap((meaning) => {
    const nextStepProtected = nextMeaning && meaning.block !== "next_step"
      ? new Set(protectedTokens(nextMeaning.text))
      : new Set<string>();
    const expected = protectedTokens(meaning.text).filter((item) => !nextStepProtected.has(item));
    const actualBlock = meaning.block === "conversation_result" ? candidate.conversation_result
      : meaning.block === "key_facts" ? candidate.key_facts.map((item) => item.value).join(" ")
        : meaning.block === "next_step" ? candidate.next_step : candidate.quotes.map((item) => item.text).join(" ");
    const missing = expected.filter((item) => !protectedPresent(actualBlock, item));
    const negationCoveredByDedicatedFact = meaning.block === "conversation_result"
      && required.some((item) => item.block === "key_facts" && hasNegation(item.text));
    if (hasNegation(meaning.text) && !negationCoveredByDedicatedFact && !hasNegation(actualBlock)) missing.push("negation");
    return missing.map((item) => `${meaning.meaningId}:${item}`);
  });
  const residue = technicalResidue(allText);
  const nextStepDuplicationCount = nextMeaning && nextStepDuplicatedInText(candidate.conversation_result, candidate.next_step) ? 1 : 0;
  const diagnostics: SummaryFinalDiagnosticsV3 = {
    requiredMeaningIds: required.map((item) => item.meaningId),
    missingMeaningIds,
    duplicatedMeaningIds,
    protectedValueViolations,
    technicalResidue: residue,
    nextStepDuplicationCount,
  };
  if (missingMeaningIds.length || duplicatedMeaningIds.length || protectedValueViolations.length || residue.length || nextStepDuplicationCount) {
    return { ok: false, error: "SUMMARY_STRUCTURAL_VALIDATION_FAILED", transformations, diagnostics };
  }
  return {
    ok: true,
    value: candidate,
    status: transformations.length ? "transformed" : "unchanged",
    transformations,
    diagnostics,
  };
}
