"use client";

import * as React from "react";
import { Button, Checkbox, Select, Textarea } from "@/shared/ui";
import { evaluationChecklist, type EvaluationCheck, type FloorPlanEvaluation } from "../domain/schema";

const labels: Record<EvaluationCheck, string> = {
  walls: "Все стены сохранены", rooms: "Конфигурация помещений правильная", windows: "Окна правильные", doors: "Двери правильные",
  openings: "Дверные проёмы правильные", areas: "Площади правильные", dimensions: "Размеры правильные", balconies: "Балконы/лоджии правильные",
  fixtures: "Сантехника правильная", noInvented: "Нет придуманных элементов", publishableWithoutFixes: "Пригоден для публикации без исправлений",
};

const emptyEvaluation = (): FloorPlanEvaluation => ({
  checklist: Object.fromEntries(evaluationChecklist.map((key) => [key, false])) as FloorPlanEvaluation["checklist"],
  geometryAccuracy: 3, sourceFidelity: 3, visualQuality: 3, manualCorrections: "0", publishable: false, criticalGeometryError: false, comment: "",
});

function evaluationValue(initial: FloorPlanEvaluation | null): FloorPlanEvaluation & { sourceFidelity: number } {
  const empty = emptyEvaluation();
  return {
    ...empty,
    ...initial,
    checklist: { ...empty.checklist, ...initial?.checklist },
    sourceFidelity: initial?.sourceFidelity ?? 3,
  };
}

export function EvaluationForm({ initial, onSave }: { initial: FloorPlanEvaluation | null; onSave: (evaluation: FloorPlanEvaluation) => void }) {
  const [value, setValue] = React.useState(evaluationValue(initial));
  React.useEffect(() => { setValue(evaluationValue(initial)); }, [initial]);
  return (
    <div className="grid gap-3 border-t border-border pt-3">
      <h4 className="text-sm font-semibold">Ручная оценка</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {evaluationChecklist.map((key) => <label key={key} className="flex items-start gap-2 text-xs"><Checkbox checked={value.checklist[key]} onChange={(event) => setValue({ ...value, checklist: { ...value.checklist, [key]: event.target.checked } })} /><span>{labels[key]}</span></label>)}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
        <label className="grid min-w-0 gap-1 text-xs">Точность геометрии (1–5)<Select aria-label="Точность геометрии (1–5)" value={value.geometryAccuracy} onChange={(event) => setValue({ ...value, geometryAccuracy: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((item) => <option key={item}>{item}</option>)}</Select></label>
        <label className="grid min-w-0 gap-1 text-xs">Соответствие исходнику (1–5)<Select aria-label="Соответствие исходнику (1–5)" value={value.sourceFidelity} onChange={(event) => setValue({ ...value, sourceFidelity: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((item) => <option key={item}>{item}</option>)}</Select></label>
        <label className="grid min-w-0 gap-1 text-xs">Качество визуализации (1–5)<Select aria-label="Качество визуализации (1–5)" value={value.visualQuality} onChange={(event) => setValue({ ...value, visualQuality: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((item) => <option key={item}>{item}</option>)}</Select></label>
        <label className="grid min-w-0 gap-1 text-xs">Количество исправлений<Select aria-label="Количество исправлений" value={value.manualCorrections} onChange={(event) => setValue({ ...value, manualCorrections: event.target.value as FloorPlanEvaluation["manualCorrections"] })}>{["0", "1", "2", "3", "4", "5+"].map((item) => <option key={item}>{item}</option>)}</Select></label>
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        <label className="flex items-center gap-2"><Checkbox checked={value.publishable} onChange={(event) => setValue({ ...value, publishable: event.target.checked })} />Готово к публикации</label>
        <label className="flex items-center gap-2"><Checkbox checked={value.criticalGeometryError} onChange={(event) => setValue({ ...value, criticalGeometryError: event.target.checked })} />Есть критическая ошибка геометрии</label>
      </div>
      <label className="grid gap-1 text-xs">Комментарий<Textarea aria-label="Комментарий" placeholder="Опишите найденные ошибки или особенности результата" value={value.comment} onChange={(event) => setValue({ ...value, comment: event.target.value })} /></label>
      <Button className="w-fit" variant="primary" onClick={() => onSave(value)}>Сохранить оценку</Button>
    </div>
  );
}
