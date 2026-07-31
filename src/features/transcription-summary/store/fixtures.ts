import type { PipelineContractManifest } from "../contracts/contract-types";
import { AI_SUMMARY_V3_PIPELINE_VERSION } from "../contracts/constants";
import { createContractManifest } from "../contracts/manifest";
import type { BuildConversationStoreV3Input } from "./builder";
import { calculateTranscriptContentHash } from "./builder";

const turns = [
  {
    id: "turn-facts",
    sequence: 0,
    speaker: "client" as const,
    text: "Там переуступка?",
    started_at_ms: null,
    ended_at_ms: null,
  },
  {
    id: "turn-needs",
    sequence: 1,
    speaker: "client" as const,
    text: "Покупаю за наличные.",
    started_at_ms: null,
    ended_at_ms: null,
  },
  {
    id: "turn-outcome",
    sequence: 2,
    speaker: "agent" as const,
    text: "Отправлю планировки на email.",
    started_at_ms: null,
    ended_at_ms: null,
  },
];

function transcript() {
  const value = {
    transcript_id: "transcript-phase-4",
    turns,
    metadata: { run_id: "run-phase-4" },
    validation_warnings: [],
  };
  return {
    ...value,
    metadata: {
      ...value.metadata,
      sha256: calculateTranscriptContentHash(value),
    },
  };
}

function manifest(): PipelineContractManifest {
  return createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION);
}

const facts = {
  confirmed_facts: [{
    id: "fact-1",
    kind: "client_fact",
    subject: "client",
    predicate: "funding_source",
    value: "наличные / депозит",
    source_turn_ids: ["turn-needs"],
    evidence: "Покупаю за наличные.",
    confidence: 1,
    verification_status: "extracted",
  }],
  client_questions: [{
    id: "question-1",
    question: "Там переуступка?",
    source_turn_ids: ["turn-facts"],
    evidence: "Там переуступка?",
    confidence: 1,
    verification_status: "extracted",
  }],
  quotes: [{
    id: "quote-1",
    speaker: "client",
    text: "Покупаю за наличные.",
    source_turn_id: "turn-needs",
    supports_fact_ids: ["fact-1"],
    confidence: 1,
    verification_status: "extracted",
  }],
  contextual_statements: [],
  rejected_assumptions: [],
} as const;

const needs = {
  business_needs: [],
  property_requirements: [],
  structured_crm_attributes: {
    interested_in: [],
    funding_source: {
      id: "funding-1",
      value: "наличные / депозит",
      source_turn_ids: ["turn-needs"],
      evidence: "Покупаю за наличные.",
      confidence: 1,
      verification_status: "extracted",
    },
    purchase_term: {
      id: "term-1",
      value: "не определено",
      source_turn_ids: ["turn-needs"],
      evidence: "Срок не обсуждался.",
      confidence: 1,
      verification_status: "extracted",
    },
  },
  communication_preferences: [],
  client_questions: [],
} as const;

const outcome = {
  call_results: [{
    id: "result-1",
    value: "согласована отправка планировок",
    confidence: 1,
    source_fact_ids: [],
    source_turn_ids: ["turn-outcome"],
  }],
  agreements: [{
    id: "agreement-1",
    action: "Отправить планировки",
    owner: "Агент",
    recipient: "Клиент",
    deadline: "",
    channel: "email",
    status: "confirmed",
    confidence: 1,
    source_fact_ids: [],
    source_turn_ids: ["turn-outcome"],
  }],
  primary_next_step: {
    agreement_ids: ["agreement-1"],
    action: "Отправить планировки",
    owner: "Агент",
    recipient: "Клиент",
    deadline: "",
    channel: "email",
    status: "confirmed",
    confidence: 1,
  },
  outcome_meta: { result_count: 1, agreement_count: 1, decision: "EXTRACTED" },
} as const;

export function createPhase4StoreInput(): BuildConversationStoreV3Input {
  return { manifest: manifest(), transcript: transcript(), facts, needs, outcome };
}

export function createPhase4StoreWithoutNeedsInput(): BuildConversationStoreV3Input {
  return { ...createPhase4StoreInput(), needs: undefined };
}

export function createPhase4StoreWithoutAgreementInput(): BuildConversationStoreV3Input {
  return {
    ...createPhase4StoreInput(),
    outcome: {
      ...outcome,
      agreements: [],
      primary_next_step: {
        agreement_ids: [],
        action: "",
        owner: "",
        recipient: "",
        deadline: "",
        channel: "",
        status: "not_defined",
        confidence: 0,
      },
      outcome_meta: { result_count: 1, agreement_count: 0, decision: "EXTRACTED" },
    },
  };
}

export function createPhase4StoreWithoutNextStepInput(): BuildConversationStoreV3Input {
  return createPhase4StoreWithoutAgreementInput();
}
