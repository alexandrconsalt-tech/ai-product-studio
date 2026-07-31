import type {
  CrmPublicationRepositoryV3,
  PendingPublicationRecord,
  PublicationError,
  PublicationRecord,
  ReserveResult,
} from "./types";

export class InMemoryCrmPublicationRepositoryV3 implements CrmPublicationRepositoryV3 {
  readonly #records = new Map<string, PublicationRecord>();

  async findByIdempotencyKey(key: string): Promise<PublicationRecord | null> {
    return this.#records.get(key) ?? null;
  }

  async reserve(pending: PendingPublicationRecord): Promise<ReserveResult> {
    const existing = this.#records.get(pending.idempotencyKey);
    if (existing?.state === "PUBLISHED") {
      return { status: "ALREADY_PUBLISHED", record: existing };
    }
    if (existing?.state === "PENDING" || (existing?.state === "FAILED" && !existing.retryable)) {
      return { status: "CONFLICT", record: existing };
    }
    const record: PublicationRecord = {
      idempotencyKey: pending.idempotencyKey,
      executionId: pending.executionId,
      state: "PENDING",
      publicationId: null,
      error: null,
      retryable: false,
      attempts: (existing?.attempts ?? 0) + 1,
    };
    this.#records.set(pending.idempotencyKey, record);
    return { status: "RESERVED", record };
  }

  async markPublished(key: string, publicationId: string): Promise<void> {
    const record = this.#records.get(key);
    if (!record || record.state !== "PENDING") throw new Error("CRM_PUBLICATION_NOT_PENDING");
    this.#records.set(key, {
      ...record,
      state: "PUBLISHED",
      publicationId,
      error: null,
      retryable: false,
    });
  }

  async markFailed(key: string, error: PublicationError): Promise<void> {
    const record = this.#records.get(key);
    if (!record || record.state !== "PENDING") throw new Error("CRM_PUBLICATION_NOT_PENDING");
    this.#records.set(key, {
      ...record,
      state: "FAILED",
      publicationId: null,
      error,
      retryable: error.retryable,
    });
  }
}
