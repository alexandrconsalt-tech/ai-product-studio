import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JSDOM, VirtualConsole } from "jsdom";

const html = readFileSync(join(process.cwd(), "public/pipeline-lab-v3.html"), "utf8");
const transcriptionModuleUrl =
  "http://localhost/pipeline-lab-v3.html?productName=" +
  encodeURIComponent("Модуль транскрибации и AI-саммари звонков");

function createLab(storage: ReadonlyMap<string, string>) {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("error", (error: unknown) => errors.push(String(error)));
  virtualConsole.on("jsdomError", (error: unknown) => errors.push(error instanceof Error ? error.message : String(error)));

  const dom = new JSDOM(html, {
    url: transcriptionModuleUrl,
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window: Window & typeof globalThis) {
      window.scrollTo = () => undefined;
      window.HTMLElement.prototype.scrollIntoView = () => undefined;
      for (const [key, value] of storage) {
        window.localStorage.setItem(key, value);
      }
    },
  });

  expect(errors).toEqual([]);
  return dom;
}

function snapshotStorage(dom: JSDOM) {
  const storage = new Map<string, string>();
  const { localStorage } = dom.window;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key) storage.set(key, localStorage.getItem(key) ?? "");
  }

  return storage;
}

function stageCount(dom: JSDOM) {
  return dom.window.document.querySelectorAll(".stage").length;
}

function storedPipeline(storage: ReadonlyMap<string, string>) {
  const raw = storage.get("pipelineLabV3.pipelineConfig");
  expect(raw).toBeTruthy();
  return JSON.parse(raw ?? "{}") as {
    stages: unknown[];
    deletedStageOutKeys?: string[];
  };
}

describe("Pipeline Lab v3 persistence", () => {
  it("keeps user-deleted stages deleted after reload and preserves an intentionally blank pipeline", () => {
    let storage = new Map<string, string>();
    let dom = createLab(storage);
    const initialCount = stageCount(dom);

    expect(initialCount).toBeGreaterThanOrEqual(16);

    for (let index = 0; index < 3; index += 1) {
      const deleteButton = dom.window.document.querySelector<HTMLButtonElement>("[data-del]");
      expect(deleteButton).toBeTruthy();
      deleteButton?.click();
    }

    storage = snapshotStorage(dom);
    const afterDelete = storedPipeline(storage);
    expect(afterDelete.stages).toHaveLength(initialCount - 3);
    expect(afterDelete.deletedStageOutKeys?.length).toBeGreaterThanOrEqual(3);
    dom.window.close();

    dom = createLab(storage);
    expect(stageCount(dom)).toBe(initialCount - 3);

    const preset = dom.window.document.getElementById("preset") as HTMLSelectElement;
    preset.value = "blank";
    preset.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    storage = snapshotStorage(dom);
    dom.window.close();

    dom = createLab(storage);
    expect(stageCount(dom)).toBe(0);
    dom.window.close();
  });
});
