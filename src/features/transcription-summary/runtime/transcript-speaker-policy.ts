type RawTurn = Record<string, unknown>;

const ROLE_MARKER = /^\s*[—–-]?\s*(клиент|агент|оператор)\s*:\s*$/iu;

const ROLE_BY_MARKER = {
  клиент: "client",
  агент: "agent",
  оператор: "operator",
} as const;

/**
 * Normalizes marker-based transcripts before the v3 contract boundary.
 * Content turn ids and sequence numbers are intentionally preserved so every
 * extracted item remains traceable to the provider transcript.
 */
export function applyTranscriptSpeakerInheritanceV3(input: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(input.turns)) return input;
  let activeSpeaker: (typeof ROLE_BY_MARKER)[keyof typeof ROLE_BY_MARKER] | null = null;
  let markerCount = 0;
  let inheritedCount = 0;
  const turns: RawTurn[] = [];

  for (const raw of input.turns) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      turns.push(raw as RawTurn);
      continue;
    }
    const turn = raw as RawTurn;
    const marker = typeof turn.text === "string" ? turn.text.match(ROLE_MARKER) : null;
    if (marker) {
      activeSpeaker = ROLE_BY_MARKER[marker[1].toLocaleLowerCase("ru-RU") as keyof typeof ROLE_BY_MARKER];
      markerCount += 1;
      continue;
    }
    if (turn.speaker === "other" && activeSpeaker) {
      turns.push({ ...turn, speaker: activeSpeaker });
      inheritedCount += 1;
    } else {
      turns.push(turn);
    }
  }

  if (!markerCount) return input;
  const warnings = Array.isArray(input.validation_warnings)
    ? input.validation_warnings.filter((item): item is string => typeof item === "string")
    : [];
  return {
    ...input,
    turns,
    validation_warnings: [
      ...warnings,
      `speaker_marker_turns_removed:${markerCount}`,
      `speaker_roles_inherited:${inheritedCount}`,
    ],
  };
}
