// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FloorPlanEvaluation } from "../domain/schema";
import { EvaluationForm } from "./evaluation-form";

const legacyEvaluation: FloorPlanEvaluation = {
  checklist: {
    walls: true, rooms: false, windows: false, doors: false, openings: false, areas: false,
    dimensions: false, balconies: false, fixtures: false, noInvented: false, publishableWithoutFixes: false,
  },
  geometryAccuracy: 2,
  visualQuality: 4,
  manualCorrections: "1",
  publishable: false,
  criticalGeometryError: false,
  comment: "Старая оценка",
};

describe("EvaluationForm", () => {
  it("загружает legacy-оценку и сохраняет все русифицированные поля с соответствием исходнику", () => {
    const onSave = vi.fn();
    render(<EvaluationForm initial={legacyEvaluation} onSave={onSave} />);

    expect(screen.getByLabelText("Точность геометрии (1–5)")).toHaveValue("2");
    expect(screen.getByLabelText("Соответствие исходнику (1–5)")).toHaveValue("3");
    expect(screen.getByLabelText("Качество визуализации (1–5)")).toHaveValue("4");
    expect(screen.getByLabelText("Количество исправлений")).toHaveValue("1");
    expect(screen.getByPlaceholderText("Опишите найденные ошибки или особенности результата")).toHaveValue("Старая оценка");
    expect(screen.queryByText(/YES|Geometry accuracy|Visual quality|Critical geometry error|Publishable:/)).not.toBeInTheDocument();
    for (const label of [
      "Все стены сохранены", "Конфигурация помещений правильная", "Окна правильные", "Двери правильные",
      "Дверные проёмы правильные", "Площади правильные", "Размеры правильные", "Балконы/лоджии правильные",
      "Сантехника правильная", "Нет придуманных элементов", "Пригоден для публикации без исправлений",
    ]) expect(screen.getByRole("checkbox", { name: label })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Соответствие исходнику (1–5)"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Готово к публикации" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Есть критическая ошибка геометрии" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить оценку" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      geometryAccuracy: 2,
      sourceFidelity: 5,
      visualQuality: 4,
      manualCorrections: "1",
      publishable: true,
      criticalGeometryError: true,
      comment: "Старая оценка",
    }));
  });
});
