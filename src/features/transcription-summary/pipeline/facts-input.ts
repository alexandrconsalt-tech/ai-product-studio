import { stableStringify } from "../contracts/schema-utils";
import type { TranscriptV3 } from "../contracts/transcript/v3/contract";

export type CompactFactsTurnV3 = Readonly<{
  id: string;
  speaker: TranscriptV3["turns"][number]["speaker"];
  text: string;
}>;

export type FactsInputCompactionV3 = Readonly<{
  turns: readonly CompactFactsTurnV3[];
  removedTurnIds: readonly string[];
  transcriptTokens: number;
  originalContextTokens: number;
  duplicatedContextTokensRemoved: number;
}>;

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function compactTurn(turn: TranscriptV3["turns"][number]): CompactFactsTurnV3 {
  return { id: turn.id, speaker: turn.speaker, text: turn.text };
}

function isProtectedAgentTurn(text: string): boolean {
  return /(?:документ|дду|собствен|обремен|ипотек|наличн|деньг|бюджет|цен|стоим|площад|этаж|адрес|объект|квартир|дом|участ|просмотр|показ|встреч|звон|отправ|срок|торг|задат|аванс)/iu.test(text);
}

function isRemovableTechnicalTurn(text: string): boolean {
  const normalized = text
    .toLocaleLowerCase("ru-RU")
    .replace(/[—–-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return /^(?:да|угу|ага|алло|хорошо|понятно|спасибо|пожалуйста|добрый\s+(?:день|вечер|утро)|здравствуйте|до\s+свидания|всего\s+доброго)[.!?\s]*$/u.test(normalized)
    || /^\[(?:неразборчиво|тишина|шум|соединение)\]$/u.test(normalized);
}

export function buildCompactFactsInputV3(
  transcript: TranscriptV3,
  mode: "initial" | "retry",
): FactsInputCompactionV3 {
  const minimalTurns = transcript.turns.map(compactTurn);
  const minimalPayload = { turns: minimalTurns };
  const originalVerbosePayload = {
    transcript,
    source_references: minimalTurns.map((turn) => ({
      turn_id: turn.id,
      speaker: turn.speaker,
      text: turn.text,
    })),
  };
  const minimalTokens = estimateTokens(stableStringify(minimalPayload));
  const originalContextTokens = estimateTokens(stableStringify(originalVerbosePayload));
  const longTranscript = minimalTokens > 8_000 || minimalTurns.length > 80;
  const shouldCompactNoise = mode === "retry" || longTranscript;
  const turns = shouldCompactNoise
    ? minimalTurns.filter((turn) =>
        turn.speaker === "client"
        || isProtectedAgentTurn(turn.text)
        || !isRemovableTechnicalTurn(turn.text))
    : minimalTurns;
  const kept = new Set(turns.map((turn) => turn.id));
  return Object.freeze({
    turns: Object.freeze(turns),
    removedTurnIds: Object.freeze(minimalTurns.filter((turn) => !kept.has(turn.id)).map((turn) => turn.id)),
    transcriptTokens: estimateTokens(stableStringify({ turns })),
    originalContextTokens,
    duplicatedContextTokensRemoved: Math.max(
      0,
      originalContextTokens - estimateTokens(stableStringify({ turns })),
    ),
  });
}

export function estimateFactsPromptTokensV3(value: string): number {
  return estimateTokens(value);
}
