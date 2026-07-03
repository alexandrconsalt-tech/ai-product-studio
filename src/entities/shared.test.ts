import { describe, expect, it } from "vitest";
import { createEntityId, EntityIdSchema, IsoDateTimeSchema, LifecycleStatusSchema, ReviewStatusSchema, VersionSchema } from "./shared";

describe("shared primitives", () => {
  it("createEntityId prefixes a uuid", () => {
    const id = createEntityId("project");
    expect(id.startsWith("project_")).toBe(true);
    expect(EntityIdSchema.safeParse(id).success).toBe(true);
  });

  it("EntityIdSchema rejects empty strings", () => {
    expect(EntityIdSchema.safeParse("").success).toBe(false);
  });

  it("IsoDateTimeSchema accepts ISO datetimes and rejects plain dates", () => {
    expect(IsoDateTimeSchema.safeParse(new Date().toISOString()).success).toBe(true);
    expect(IsoDateTimeSchema.safeParse("2026-07-03").success).toBe(false);
  });

  it("VersionSchema requires a non-empty string", () => {
    expect(VersionSchema.safeParse("1.0.0").success).toBe(true);
    expect(VersionSchema.safeParse("").success).toBe(false);
  });

  it("LifecycleStatusSchema only accepts the six documented statuses", () => {
    expect(LifecycleStatusSchema.safeParse("ready").success).toBe(true);
    expect(LifecycleStatusSchema.safeParse("deprecated").success).toBe(false);
  });

  it("ReviewStatusSchema only accepts the four documented statuses", () => {
    expect(ReviewStatusSchema.safeParse("approved").success).toBe(true);
    expect(ReviewStatusSchema.safeParse("pending").success).toBe(false);
  });
});
