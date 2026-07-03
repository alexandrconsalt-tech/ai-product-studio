import { z } from "zod";

export const EntityIdSchema = z.string().min(1);
export type EntityId = z.infer<typeof EntityIdSchema>;

export const IsoDateTimeSchema = z.string().datetime();
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

export const VersionSchema = z.string().min(1);
export type Version = z.infer<typeof VersionSchema>;

export const ReviewStatusSchema = z.enum(["not_reviewed", "approved", "requires_changes", "rejected"]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const LifecycleStatusSchema = z.enum(["draft", "in_progress", "review", "ready", "completed", "archived"]);
export type LifecycleStatus = z.infer<typeof LifecycleStatusSchema>;

export const createEntityId = (prefix: string): EntityId => `${prefix}_${crypto.randomUUID()}`;
export const createTimestamp = (): IsoDateTime => new Date().toISOString();

