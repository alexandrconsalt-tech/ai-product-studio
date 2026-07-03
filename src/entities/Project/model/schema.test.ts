import { describe, expect, it } from "vitest";
import { createProject } from "./factory";
import { ProjectSchema, ProjectStatusSchema } from "./schema";

describe("Project", () => {
  it("factory defaults status to draft and produces a schema-valid project", () => {
    const project = createProject({ name: "AI Call Analysis" });
    expect(project.status).toBe("draft");
    expect(ProjectSchema.safeParse(project).success).toBe(true);
    expect(project.playgroundRunIds).toEqual([]);
    expect(project.reviewIds).toEqual([]);
  });

  it("follows the documented ENTITY_LIFECYCLE.md status set exactly", () => {
    const documented = ["draft", "discovery", "product_ready", "architecture_ready", "pipeline_ready", "testing", "completed", "archived"];
    for (const status of documented) {
      expect(ProjectStatusSchema.safeParse(status).success).toBe(true);
    }
    expect(ProjectStatusSchema.safeParse("in_progress").success).toBe(false);
  });

  it("rejects an empty name", () => {
    const project = createProject({ name: "" });
    expect(ProjectSchema.safeParse(project).success).toBe(false);
  });
});
