import type { PipelineContractManifest } from "../contracts/contract-types";
import type { SummaryQualityGateResultV3 } from "../contracts/quality-gate/v3/contract";
import type { ConversationStoreV3 } from "../contracts/conversation-store/v3/contract";
import type { SummaryV3 } from "../contracts/summary/v3/contract";
import { executeSummaryQualityGateV3 } from "../quality-gate";
import { createSummaryQualityGateFixture } from "../quality-gate/fixtures";

export type CrmPublicationFixture = Readonly<{
  manifest: PipelineContractManifest;
  conversationStore: ConversationStoreV3;
  summary: SummaryV3;
  qualityGate: SummaryQualityGateResultV3;
  target: { crmSystem: string; entityType: "call"; entityId: string };
}>;

export function createCrmPublicationFixture(
  scores: Parameters<typeof createSummaryQualityGateFixture>[0] = {},
): CrmPublicationFixture {
  const fixture = createSummaryQualityGateFixture(scores);
  const gate = executeSummaryQualityGateV3(fixture);
  return {
    manifest: fixture.manifest,
    conversationStore: fixture.conversationStore,
    summary: fixture.summary,
    qualityGate: gate.value,
    target: { crmSystem: "mock-crm", entityType: "call", entityId: "call-phase-8" },
  };
}
