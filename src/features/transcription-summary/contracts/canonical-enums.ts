export const SPEAKER_ROLES = ["client", "agent", "operator", "other"] as const;
export const VERIFICATION_STATUSES = ["pending", "verified", "rejected"] as const;
export const JUDGE_VERDICTS = ["verified", "rejected", "needs_correction", "not_enough_evidence"] as const;

export const INTEREST_VALUES = ["Новостройки", "Ипотека", "Строительство"] as const;
export const FUNDING_SOURCE_VALUES = [
  "наличные / депозит",
  "ипотека одобрена",
  "ипотека в процессе",
  "продажа своей квартиры",
  "не определено",
] as const;
export const PURCHASE_TERM_VALUES = [
  "до 1 месяца",
  "2–3 месяца",
  "3–6 месяцев",
  "более 6 месяцев",
  "не определено",
] as const;

export const COMMUNICATION_CHANNEL_VALUES = [
  "whatsapp",
  "email",
  "phone",
  "max",
  "telegram",
] as const;

export const PARTY_VALUES = ["agent", "client", "operator", "both", "third_party", "not_defined"] as const;
export const RECIPIENT_VALUES = [...PARTY_VALUES, "owner"] as const;
export const OUTCOME_STATUS_VALUES = ["proposed", "agreed", "promised", "completed", "declined", "not_defined"] as const;
export const CALL_RESULT_VALUES = ["productive", "no_result", "follow_up_required", "declined"] as const;

export const SUMMARY_CRITERIA = ["faithfulness", "completeness", "usefulness", "agreements_next_step", "format"] as const;
export const QUALITY_GATE_DECISIONS = ["QUALITY_RECORDED"] as const;
