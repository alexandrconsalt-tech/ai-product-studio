import { describe, expect, it } from "vitest";
import { emptyPromptRegistry, PromptNotFoundError, PromptRenderError } from "./prompt-registry";

describe("PromptRegistry", () => {
  it("registers and resolves the latest version by default", () => {
    const registry = emptyPromptRegistry.register("p1", "1.0.0", "Hello {{name}}").register("p1", "1.1.0", "Hi {{name}}!");
    expect(registry.resolve("p1").version).toBe("1.1.0");
    expect(registry.resolve("p1", "1.0.0").version).toBe("1.0.0");
  });

  it("does not mutate the original registry on register (immutable, matches StageRegistry/LLMProviderRegistry pattern)", () => {
    const base = emptyPromptRegistry.register("p1", "1.0.0", "v1");
    const extended = base.register("p1", "1.1.0", "v2");
    expect(base.versions("p1")).toHaveLength(1);
    expect(extended.versions("p1")).toHaveLength(2);
  });

  it("throws PromptNotFoundError for an unregistered prompt id", () => {
    expect(() => emptyPromptRegistry.resolve("nope")).toThrow(PromptNotFoundError);
  });

  it("throws PromptNotFoundError for an unregistered version", () => {
    const registry = emptyPromptRegistry.register("p1", "1.0.0", "v1");
    expect(() => registry.resolve("p1", "2.0.0")).toThrow(PromptNotFoundError);
  });

  it("rejects re-registering the same version (immutability, CLAUDE.md §17 PV-2)", () => {
    const registry = emptyPromptRegistry.register("p1", "1.0.0", "v1");
    expect(() => registry.register("p1", "1.0.0", "different content")).toThrow(/already registered/);
  });

  it("renders {{snake_case}} variables (CLAUDE.md §15 PE-3)", () => {
    const registry = emptyPromptRegistry.register("greeting", "1.0.0", "Hello {{customer_name}}, your order {{order_id}} shipped.");
    const rendered = registry.render("greeting", { customer_name: "Alex", order_id: "42" });
    expect(rendered).toBe("Hello Alex, your order 42 shipped.");
  });

  it("throws PromptRenderError listing every missing variable", () => {
    const registry = emptyPromptRegistry.register("p", "1.0.0", "{{a}} and {{b}}");
    expect(() => registry.render("p", { a: "x" })).toThrow(PromptRenderError);
    try {
      registry.render("p", {});
    } catch (error) {
      expect((error as Error).message).toContain("a");
      expect((error as Error).message).toContain("b");
    }
  });

  it("renders a specific pinned version, not just latest", () => {
    const registry = emptyPromptRegistry.register("p", "1.0.0", "old {{x}}").register("p", "2.0.0", "new {{x}}");
    expect(registry.render("p", { x: "1" }, "1.0.0")).toBe("old 1");
    expect(registry.render("p", { x: "1" })).toBe("new 1");
  });
});
