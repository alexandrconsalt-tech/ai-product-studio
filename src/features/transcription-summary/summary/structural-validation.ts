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
  missingP0MeaningIds: readonly string[];
  duplicatedMeaningIds: readonly string[];
  semanticRepetitionCount: number;
  invalidQuoteCount: number;
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
  if (/(?:next_step|conversation_result|key_facts|summary[_\s-]*plan)\s*\)?/iu.test(value)) result.push("TECHNICAL_FIELD_NAME");
  if (/(?:объект\s*:\s*00|не\s+объект\s*(?:м²|кв\.?\s*м)?)/iu.test(value)) result.push("CORRUPTED_VALUE");
  const opens = (value.match(/\(/gu) ?? []).length;
  const closes = (value.match(/\)/gu) ?? []).length;
  if (opens !== closes || /(?:next_step|conversation_result|key_facts)\s*\)/iu.test(value)) result.push("UNBALANCED_PARENTHESES");
  return [...new Set(result)];
}

function renderPlannedFacts(meanings: readonly SummaryPlanMeaning[]): SummaryV3["key_facts"] {
  const used = new Map<string, number>();
  return meanings
    .filter((meaning, index, values) => values.findIndex((item) => normalized(item.text) === normalized(meaning.text)) === index)
    .map((meaning) => {
      const base = label(meaning);
      const count = (used.get(base) ?? 0) + 1;
      used.set(base, count);
      return { label: count === 1 ? base : `${base} ${count}`, value: meaning.text };
    });
}

function keyFactDuplicateCodes(facts: SummaryV3["key_facts"]): readonly string[] {
  const labels = facts.map((item) => normalized(item.label));
  const values = facts.map((item) => normalized(item.value));
  const result: string[] = [];
  if (new Set(labels).size !== labels.length) result.push("DUPLICATE_KEY_FACT_LABEL");
  if (new Set(values).size !== values.length) result.push("DUPLICATE_KEY_FACT_VALUE");
  return result;
}

function actionChannelCodes(nextStep: string): readonly string[] {
  return /(?:провед\S*\s+просмотр|покаж\S*\s+(?:квартир|объект)|приед\S*\s+на\s+просмотр)/iu.test(normalized(nextStep))
    && /(?:по\s+телефону|phone|телефонн\S*\s+канал)/iu.test(normalized(nextStep))
    ? ["NEXT_STEP_CHANNEL_CONFLICT"]
    : [];
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
  if (meaning.label) return meaning.label;
  if (meaning.kind === "client_goal") return "Цель";
  if (/(?:бюджет|руб|₽|млн|миллион)/iu.test(meaning.text)) return "Бюджет";
  if (/(?:документ|оригинал)/iu.test(meaning.text)) return "Документы";
  if (/(?:собственник|дду|зарегистрирован|прописан|юрид|обремен)/iu.test(meaning.text)) return "Юридический статус";
  if (/(?:ипотек|финанс|сбербанк|наличн|депозит|деньги\s+находятся\s+на\s+сч[её]т)/iu.test(meaning.text)) return "Финансирование";
  if (/(?:срок|месяц)/iu.test(meaning.text)) return "Срок";
  if (/(?:возраж|сомнен|не\s+подход|дорог|высок\S*\s+цен)/iu.test(meaning.text)) return "Возражение";
  return /(?:не рассматрива|огранич|критич)/iu.test(meaning.text) ? "Ограничение" : "Требование";
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
  /(?:позвон|перезвон|созвон|свя[зж]|контакт)/u,
  /(?:встреч|встрет|приед|приех|прибы|осмотр|просмотр)/u,
  /(?:показ|демонстр)/u,
] as const;

function sharedNextStepAction(value: string, nextStep: string): boolean {
  const actual = normalized(value);
  const expected = normalized(nextStep);
  const contact = /(?:позвон|перезвон|созвон|свя[зж]|контакт)/u;
  if (contact.test(actual) || contact.test(expected)) return contact.test(actual) && contact.test(expected);
  const primaryFamily = (text: string): number => {
    let selected = -1;
    let selectedIndex = Number.POSITIVE_INFINITY;
    NEXT_STEP_ACTION_FAMILIES.forEach((pattern, index) => {
      const matchIndex = text.search(pattern);
      if (matchIndex >= 0 && matchIndex < selectedIndex) {
        selected = index;
        selectedIndex = matchIndex;
      }
    });
    return selected;
  };
  const actualFamily = primaryFamily(actual);
  return actualFamily >= 0 && actualFamily === primaryFamily(expected);
}

function isAllowedCompactOutcome(value: string, nextStep: string): boolean {
  const actual = normalized(value).replace(/[.!?]+$/u, "");
  if (actual === normalized(compactConversationResult(nextStep)).replace(/[.!?]+$/u, "")) return true;
  if (protectedTokens(value).length) return false;
  const expected = normalized(nextStep);
  if (/(?:отправ|пришл|направ|переда)/u.test(expected)
    && /^(?:согласована\s+)?отправка(?:\s+[^.!?]{0,30})?\s+согласована$|^отправка\s+согласована$/u.test(actual)) return true;
  if (/(?:просмотр|осмотр|показ|встреч)/u.test(expected)
    && /^(?:просмотр|осмотр|показ|встреча)\s+согласован[ао]?$/u.test(actual)) return true;
  return /(?:позвон|перезвон|созвон|свя[зж])/u.test(expected)
    && /^(?:договорились\s+о\s+)?повторн\S*\s+(?:звонк|контакт)/u.test(actual);
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
  if (/(?:перезвон|повторн\S* звон|позвон|связ|сообщ)/u.test(value)) return "Договорились о повторном звонке.";
  if (/(?:осмотр|просмотр|встреч|встрет)/u.test(value)) return "Просмотр согласован.";
  if (/(?:документ)/u.test(value)) return "Отправка документов согласована.";
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

function removeTechnicalFragments(value: string): string {
  return value
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/\{[^{}]*(?:"(?:status|error|message|code)"|technical_error)[^{}]*\}/giu, " ")
    .replace(/(?:^|\s)(?:technical_error|error)(?=\s|[.!?,;]|$)/giu, " ")
    .replace(/\s+([.!?,;])/gu, "$1")
    .replace(/\s+/gu, " ")
    .trim();
}

function exactDeduplicatedSentences(value: string): string {
  const seen = new Set<string>();
  return value
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => {
      const identity = normalized(sentence).replace(/[.!?]+$/u, "");
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .join(" ");
}

function removeExactNextStepDuplication(
  conversationResult: string,
  nextStep: string,
): Readonly<{ value: string; changed: boolean }> {
  const expected = normalized(nextStep).replace(/[.!?]+$/u, "");
  const sentences = conversationResult
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const kept = sentences.filter((sentence) =>
    normalized(sentence).replace(/[.!?]+$/u, "") !== expected);
  return { value: kept.join(" "), changed: kept.length !== sentences.length };
}

function plannedFactFor(value: string, meanings: readonly SummaryPlanMeaning[]): SummaryPlanMeaning | null {
  return meanings
    .map((meaning) => ({ meaning, score: overlap(value, meaning.text) }))
    .filter(({ meaning }) => protectedTokens(meaning.text).every((item) => protectedPresent(value, item)))
    .sort((left, right) => right.score - left.score)
    .find(({ score }) => score >= 0.5)?.meaning ?? null;
}

function strictPriorityPlanValidation(
  generated: SummaryV3,
  plan: SummaryPlanV3,
): StructuralValidationResult {
  const transformations: SummaryStructuralTransformation[] = [];
  const required = plan.meanings.filter((meaning) => meaning.required);
  const plannedFacts = plan.meanings.filter((meaning) => meaning.block === "key_facts");
  const plannedQuotes = plan.meanings.filter((meaning) => meaning.block === "quotes");
  const nextMeaning = plan.meanings.find((meaning) => meaning.block === "next_step");
  let conversationResult = exactDeduplicatedSentences(removeTechnicalFragments(generated.conversation_result));
  if (conversationResult !== generated.conversation_result.trim()) {
    transformations.push({
      ruleId: technicalResidue(generated.conversation_result).length
        ? "summary.technical-residue-removed.v1"
        : "summary.plan-block-enforced.v1",
      fieldPath: "conversation_result",
      meaningId: null,
      reason: "Only technical fragments and exact duplicate sentences were removed.",
    });
  }
  if (nextMeaning) {
    const exclusive = removeExactNextStepDuplication(conversationResult, nextMeaning.text);
    if (exclusive.changed) {
      conversationResult = exclusive.value;
      transformations.push({
        ruleId: "summary.exclusive-next-step.v1",
        fieldPath: "conversation_result",
        meaningId: nextMeaning.meaningId,
        reason: "Exact or detail-preserving next-step duplication was removed from conversation_result.",
      });
    }
  }

  const usedMeanings = new Set<string>();
  const usedFactValues = new Set<string>();
  const unmatchedFacts: string[] = [];
  const keyFacts = generated.key_facts.flatMap((fact) => {
    const meaning = plannedFactFor(fact.value, plannedFacts);
    if (!meaning) {
      unmatchedFacts.push(fact.value);
      return [fact];
    }
    const exactValue = normalized(fact.value);
    if (usedMeanings.has(meaning.meaningId) && usedFactValues.has(exactValue)) {
      transformations.push({
        ruleId: "summary.plan-block-enforced.v1",
        fieldPath: "key_facts",
        meaningId: meaning.meaningId,
        reason: "An exact duplicate key fact was removed.",
      });
      return [];
    }
    usedMeanings.add(meaning.meaningId);
    usedFactValues.add(exactValue);
    const normalizedFact = { label: label(meaning), value: fact.value.trim() };
    if (normalizedFact.label !== fact.label || normalizedFact.value !== fact.value) {
      transformations.push({
        ruleId: "summary.plan-block-enforced.v1",
        fieldPath: "key_facts",
        meaningId: meaning.meaningId,
        reason: "A semantic label was normalized without changing the fact value.",
      });
    }
    return [normalizedFact];
  });

  const plannedQuoteTexts = new Set(plannedQuotes.map((meaning) => normalized(meaning.text)));
  const quotes = generated.quotes.filter((quote) => plannedQuoteTexts.has(normalized(quote.text)));
  const invalidQuoteCount = generated.quotes.length - quotes.length;
  if (invalidQuoteCount) {
    transformations.push({
      ruleId: "summary.invalid-quote-removed.v1",
      fieldPath: "quotes",
      meaningId: null,
      reason: "Quotes outside the unique objection/motive/condition plan were removed.",
    });
  }

  const nextStep = nextMeaning?.text ?? generated.next_step.trim();
  if (nextMeaning && normalized(nextStep) !== normalized(generated.next_step)) {
    transformations.push({
      ruleId: "summary.protected-value-restored.v1",
      fieldPath: "next_step",
      meaningId: nextMeaning.meaningId,
      reason: "The canonical primary_next_step was restored without changing its meaning.",
    });
  }
  const candidate: SummaryV3 = { conversation_result: conversationResult, key_facts: keyFacts, quotes, next_step: nextStep };
  const missingMeaningIds = required
    .filter((meaning) => !meaningCovered(candidate, meaning))
    .map((meaning) => meaning.meaningId);
  const missingP0MeaningIds = required
    .filter((meaning) => meaning.priority === "P0" && !meaningCovered(candidate, meaning))
    .map((meaning) => meaning.meaningId);
  const crossBlockDuplicateMeanings = plannedFacts.filter((meaning) =>
    overlap(candidate.conversation_result, meaning.text) >= 0.8
    && candidate.key_facts.some((fact) => overlap(fact.value, meaning.text) >= 0.8));
  const withinFactsDuplicateMeaningIds = candidate.key_facts.flatMap((fact, index) =>
    candidate.key_facts.slice(index + 1).some((other) => overlap(fact.value, other.value) >= 0.8)
      ? [plannedFactFor(fact.value, plannedFacts)?.meaningId ?? `key_fact_${index + 1}`]
      : []);
  const duplicatedMeaningIds = [...new Set([
    ...crossBlockDuplicateMeanings.map((meaning) => meaning.meaningId),
    ...withinFactsDuplicateMeaningIds,
  ])];
  const nextStepDuplicationCount = nextMeaning && nextStepDuplicatedInText(candidate.conversation_result, candidate.next_step) ? 1 : 0;
  const sentenceCount = candidate.conversation_result.split(/(?<=[.!?])\s+/u).filter(Boolean).length;
  const residue = [
    ...technicalResidue([candidate.conversation_result, ...candidate.key_facts.flatMap((fact) => [fact.label, fact.value]), candidate.next_step].join(" ")),
    ...(new Set(candidate.key_facts.map((fact) => normalized(fact.value))).size !== candidate.key_facts.length
      ? ["DUPLICATE_KEY_FACT_VALUE"] : []),
    ...actionChannelCodes(candidate.next_step),
    ...(unmatchedFacts.length ? ["UNPLANNED_KEY_FACT"] : []),
    ...(sentenceCount < 1 || sentenceCount > 3 ? ["CONVERSATION_RESULT_SENTENCE_LIMIT"] : []),
    ...(candidate.key_facts.length > 4 ? ["KEY_FACT_LIMIT"] : []),
  ];
  const diagnostics: SummaryFinalDiagnosticsV3 = {
    requiredMeaningIds: required.map((meaning) => meaning.meaningId),
    missingMeaningIds,
    missingP0MeaningIds,
    duplicatedMeaningIds,
    semanticRepetitionCount: duplicatedMeaningIds.length,
    invalidQuoteCount,
    protectedValueViolations: [],
    technicalResidue: [...new Set(residue)],
    nextStepDuplicationCount,
  };
  if (missingMeaningIds.length || duplicatedMeaningIds.length || residue.length || nextStepDuplicationCount) {
    return { ok: false, error: "SUMMARY_STRUCTURAL_VALIDATION_FAILED", transformations, diagnostics };
  }
  return { ok: true, value: candidate, status: transformations.length ? "transformed" : "unchanged", transformations, diagnostics };
}

export function applySummaryPlanAndValidate(
  generated: SummaryV3,
  plan: SummaryPlanV3,
): StructuralValidationResult {
  if (plan.version === "summary-plan-v3.2.0") return strictPriorityPlanValidation(generated, plan);
  const transformations: SummaryStructuralTransformation[] = [];
  const requiredResult = plan.meanings.filter((item) => item.required && item.block === "conversation_result");
  const required = plan.meanings.filter((item) => item.required);
  const plannedFacts = plan.meanings.filter((item) => item.block === "key_facts");
  const plannedQuotes = plan.meanings.filter((item) => item.block === "quotes");
  const nextMeaning = plan.meanings.find((item) => item.block === "next_step");
  let conversationResult = generated.conversation_result.trim();
  const generatedVisible = [generated.conversation_result, ...generated.key_facts.flatMap((item) => [item.label, item.value])].join(" ");
  const plannedVisible = plan.meanings.map((item) => item.text).join(" ");
  const generatedCardNoise = protectedTokens(generatedVisible).some((item) => !protectedPresent(plannedVisible, item))
    || (/(?:\bжк\b|\bадрес\b|\bэтаж\b)/iu.test(generatedVisible)
      && !/(?:\bжк\b|\bадрес\b|\bэтаж\b)/iu.test(plannedVisible))
    || /(?:телефон|номер)\D{0,20}\d{3,}/iu.test(generatedVisible);
  if (generatedCardNoise) {
    conversationResult = renderConversationResult(requiredResult);
    transformations.push({
      ruleId: "summary.plan-block-enforced.v1",
      fieldPath: "conversation_result",
      meaningId: null,
      reason: "Object-card data outside the Summary Plan was removed from conversation_result.",
    });
  }

  if (plannedFacts.some((meaning) => overlap(conversationResult, meaning.text) >= 0.5)) {
    conversationResult = renderConversationResult(requiredResult);
    transformations.push({
      ruleId: "summary.plan-block-enforced.v1",
      fieldPath: "conversation_result",
      meaningId: null,
      reason: "Key-fact meanings duplicated in conversation_result were removed using the deterministic block plan.",
    });
  }

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
    key_facts: renderPlannedFacts(plannedFacts),
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
  const residue = [
    ...technicalResidue(allText),
    ...keyFactDuplicateCodes(candidate.key_facts),
    ...actionChannelCodes(candidate.next_step),
  ];
  const nextStepDuplicationCount = nextMeaning && nextStepDuplicatedInText(candidate.conversation_result, candidate.next_step) ? 1 : 0;
  const diagnostics: SummaryFinalDiagnosticsV3 = {
    requiredMeaningIds: required.map((item) => item.meaningId),
    missingMeaningIds,
    missingP0MeaningIds: missingMeaningIds.filter((meaningId) =>
      required.some((meaning) => meaning.meaningId === meaningId && meaning.priority === "P0")),
    duplicatedMeaningIds,
    semanticRepetitionCount: duplicatedMeaningIds.length,
    invalidQuoteCount: 0,
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
