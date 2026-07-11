import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODEL_OPTIONS, MODEL_VENDOR } from "./browser-direct-provider";

/**
 * public/pipeline-lab-v3.html is a standalone static HTML/JS file (no build
 * step processes it, served as-is), so it cannot literally import the same
 * TypeScript module the rest of the app uses -- MODEL_OPTIONS/MODEL_VENDOR
 * are duplicated there by necessity, "kept in sync by name" per that file's
 * own comment. This test is the actual enforcement of that promise: it
 * parses the real object/array literals out of the live HTML file and
 * fails if either model list ever drifts from browser-direct-provider.ts's
 * exported catalog, instead of relying on someone remembering to update
 * both places by hand.
 */

function readPipelineLabHtml(): string {
  return readFileSync(join(process.cwd(), "public", "pipeline-lab-v3.html"), "utf8");
}

function extractHtmlModelVendor(html: string): Record<string, string> {
  const match = html.match(/const MODEL_VENDOR = \{([\s\S]*?)\};/);
  if (!match) throw new Error("MODEL_VENDOR block not found in pipeline-lab-v3.html");
  const entries = [...match[1].matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)];
  return Object.fromEntries(entries.map(([, key, value]) => [key, value]));
}

function extractHtmlModelOptions(html: string): { value: string; label: string }[] {
  const match = html.match(/const MODEL_OPTIONS = \[([\s\S]*?)\];/);
  if (!match) throw new Error("MODEL_OPTIONS block not found in pipeline-lab-v3.html");
  const entries = [...match[1].matchAll(/\{v:\s*'([^']+)',\s*t:\s*'([^']+)'\}/g)];
  return entries.map(([, value, label]) => ({ value, label }));
}

describe("model catalog stays in sync between pipeline-lab-v3.html and browser-direct-provider.ts", () => {
  it("has the exact same set of model options (value + label) in both places", () => {
    const html = readPipelineLabHtml();
    const htmlOptions = extractHtmlModelOptions(html);

    const sortByValue = (a: { value: string }, b: { value: string }) => a.value.localeCompare(b.value);
    expect([...htmlOptions].sort(sortByValue)).toEqual([...MODEL_OPTIONS].sort(sortByValue));
  });

  it("has the exact same model-to-vendor mapping in both places", () => {
    const html = readPipelineLabHtml();
    const htmlVendor = extractHtmlModelVendor(html);

    expect(htmlVendor).toEqual(MODEL_VENDOR);
  });
});
