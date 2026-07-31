import { TranscriptV3Schema, type TranscriptV3 } from "../contracts/transcript/v3/contract";
import type { SummaryV3 } from "../contracts/summary/v3/contract";
import {
  buildConversationStoreV3,
  createPhase4StoreInput,
  createPhase4StoreWithoutAgreementInput,
  createPhase4StoreWithoutNeedsInput,
  createPhase4StoreWithoutNextStepInput,
} from "../store";
import type { ConversationStoreV3 } from "../contracts/conversation-store/v3/contract";
import type { PipelineContractManifest } from "../contracts/contract-types";

export type SummaryFixtureContext = Readonly<{
  manifest: PipelineContractManifest;
  transcript: TranscriptV3;
  store: ConversationStoreV3;
  output: SummaryV3;
}>;

export const SUMMARY_CRM_DUPLICATION_FIXTURE = Object.freeze({
  keyFacts: [
    "Адрес объекта: улица Примерная, 1.",
    "Стоимость объекта: 10 000 000 рублей.",
    "Площадь объекта: 60 м².",
  ],
  expectedDisposition: "phase6_faithfulness_and_format_judges",
});

function fromStoreInput(
  input: ReturnType<typeof createPhase4StoreInput>,
): SummaryFixtureContext {
  const built = buildConversationStoreV3(input);
  if (!built.ok) throw new Error(built.error.message);
  return {
    manifest: input.manifest,
    transcript: TranscriptV3Schema.parse(input.transcript),
    store: built.store,
    output: {
      conversation_result: "Клиент уточнил условия покупки. Согласована отправка планировок.",
      key_facts: [
        { label: "Оплата", value: "Клиент покупает за наличные." },
        { label: "Вопрос", value: "Клиент уточнил условия переуступки." },
      ],
      quotes: [{ text: "Покупаю за наличные." }],
      next_step: "Агент отправит клиенту планировки по электронной почте.",
    },
  };
}

export function createSummaryFixtureContext(): SummaryFixtureContext {
  return fromStoreInput(createPhase4StoreInput());
}

export function createSummaryWithoutAttributesFixture(): SummaryFixtureContext {
  return fromStoreInput(createPhase4StoreWithoutNeedsInput());
}

export function createSummaryWithoutAgreementFixture(): SummaryFixtureContext {
  const fixture = fromStoreInput(createPhase4StoreWithoutAgreementInput());
  return {
    ...fixture,
    output: { ...fixture.output, next_step: "Следующий шаг не согласован." },
  };
}

export function createSummaryWithoutNextStepFixture(): SummaryFixtureContext {
  const fixture = fromStoreInput(createPhase4StoreWithoutNextStepInput());
  return {
    ...fixture,
    output: { ...fixture.output, next_step: "Следующий шаг не согласован." },
  };
}

function withFacts(
  factsToAdd: Array<{
    id: string;
    kind: "client_fact" | "property_fact" | "requirement_signal";
    subject: "client" | "property" | "conversation";
    predicate: string;
    value: string;
  }>,
): SummaryFixtureContext {
  const input = createPhase4StoreInput();
  const facts = input.facts as {
    confirmed_facts: Array<Record<string, unknown>>;
    client_questions: Array<Record<string, unknown>>;
    quotes: Array<Record<string, unknown>>;
    contextual_statements: Array<Record<string, unknown>>;
    rejected_assumptions: Array<Record<string, unknown>>;
  };
  return fromStoreInput({
    ...input,
    facts: {
      ...facts,
      confirmed_facts: [
        ...facts.confirmed_facts,
        ...factsToAdd.map((fact) => ({
          ...fact,
          source_turn_ids: ["turn-facts"],
          evidence: "Там переуступка?",
          confidence: 1,
          verification_status: "extracted" as const,
        })),
      ],
    },
  });
}

export function createSummaryWithObjectionFixture(): SummaryFixtureContext {
  const fixture = withFacts([{
    id: "fact-objection-1",
    kind: "client_fact",
    subject: "client",
    predicate: "objection",
    value: "Клиент сомневается в юридической схеме сделки.",
  }]);
  return {
    ...fixture,
    output: {
      ...fixture.output,
      key_facts: [{
        label: "Сомнение",
        value: "Клиент сомневается в юридической схеме сделки.",
      }],
    },
  };
}

export function createSummaryWithTwoObjectsFixture(): SummaryFixtureContext {
  const fixture = withFacts([
    {
      id: "fact-object-1",
      kind: "property_fact",
      subject: "property",
      predicate: "object_reference",
      value: "Объект A",
    },
    {
      id: "fact-object-2",
      kind: "property_fact",
      subject: "property",
      predicate: "object_reference",
      value: "Объект B",
    },
  ]);
  return {
    ...fixture,
    output: {
      ...fixture.output,
      key_facts: [{ label: "Объекты", value: "Обсуждались объект A и объект B." }],
    },
  };
}
