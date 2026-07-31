import {
  ConversationStoreV3Schema,
  type ConversationStoreV3,
} from "../contracts/conversation-store/v3/contract";

export interface ConversationStoreV3Repository {
  save(store: ConversationStoreV3): Promise<void>;
  getByRunId(runId: string): Promise<ConversationStoreV3 | null>;
}

export class InMemoryConversationStoreV3Repository
implements ConversationStoreV3Repository {
  readonly #stores = new Map<string, unknown>();

  async save(store: ConversationStoreV3): Promise<void> {
    const validated = ConversationStoreV3Schema.parse(store);
    this.#stores.set(validated.meta.run_id, structuredClone(validated));
  }

  async getByRunId(runId: string): Promise<ConversationStoreV3 | null> {
    const stored = this.#stores.get(runId);
    if (stored === undefined) return null;
    return ConversationStoreV3Schema.parse(structuredClone(stored));
  }
}
