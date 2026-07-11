// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdCopyTestBenchPanel } from "./ad-copy-test-bench-panel";

const productId = "product_ad_copy_pipeline_steps_test";
const storageKey = `adCopyTestBench.config.${productId}`;

describe("AdCopyTestBenchPanel pipeline steps", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("keeps an intentionally empty saved pipeline instead of restoring defaults", () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ version: 4, stages: [] }));

    render(<AdCopyTestBenchPanel productId={productId} onRunComplete={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Пайплайн\s*0/ })).toBeInTheDocument();
    expect(screen.queryByText("Валидация входных данных")).not.toBeInTheDocument();
  });

  it("persists add and delete operations as the current product pipeline state", () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ version: 4, stages: [] }));

    render(<AdCopyTestBenchPanel productId={productId} onRunComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Пайплайн\s*0/ }));
    fireEvent.click(screen.getByRole("button", { name: /\+ Добавить шаг/ }));

    const afterAdd = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as { stages?: unknown[] };
    expect(afterAdd.stages).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /1\s+Новый шаг/ }));
    fireEvent.click(screen.getByRole("button", { name: /Удалить/ }));

    const afterDelete = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as { stages?: unknown[] };
    expect(afterDelete.stages).toEqual([]);
  });

  it("selects one of the newly added models for a stage, persists it, and keeps it after remount", () => {
    const { unmount } = render(<AdCopyTestBenchPanel productId={productId} onRunComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Пайплайн/ }));
    fireEvent.click(screen.getByRole("button", { name: /Агент извлечения преимуществ/ }));

    const modelSelect = screen.getByLabelText("Модель") as HTMLSelectElement;
    fireEvent.change(modelSelect, { target: { value: "qwen3-235b-a22b-2507" } });

    const persisted = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as { stages?: { id: string; model?: string }[] };
    expect(persisted.stages?.find((stage) => stage.id === "benefits")?.model).toBe("qwen3-235b-a22b-2507");

    unmount();
    render(<AdCopyTestBenchPanel productId={productId} onRunComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Пайплайн/ }));
    fireEvent.click(screen.getByRole("button", { name: /Агент извлечения преимуществ/ }));

    expect((screen.getByLabelText("Модель") as HTMLSelectElement).value).toBe("qwen3-235b-a22b-2507");
  });
});
