import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ENV_KEYS = ["POSTGRES_URL", "DATABASE_URL", "POSTGRES_URL_NON_POOLING"] as const;

describe("/api/repository", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it("GET reports configured:false when no connection string is set, without touching the network", async () => {
    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();
    expect(body).toEqual({ configured: false });
  });

  it("POST reports configured:false when no connection string is set, without validating the body", async () => {
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/repository", { method: "POST", body: "not even valid json" }));
    const body = await response.json();
    expect(body).toEqual({ configured: false });
  });
});
