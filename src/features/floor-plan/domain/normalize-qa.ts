import type { FloorPlanQa } from "./schema";

const checkLabels: Record<keyof FloorPlanQa["checks"], string> = {
  roomCount: "количество помещений",
  topology: "конфигурация помещений",
  walls: "стены",
  windows: "окна",
  doors: "двери",
  doorSwings: "направления открывания дверей",
  balconies: "балконы и лоджии",
  labels: "подписи",
  areas: "площади",
  dimensions: "размеры",
  fixtures: "сантехника и оборудование",
  hallucinations: "неподтверждённые элементы",
};

const hasCyrillic = (value: string) => /[А-Яа-яЁё]/.test(value);
const isPositiveObservation = (value: string) => {
  const lower = value.toLowerCase();
  return /no (geometry|geometric|topology|factual).*(discrepancy|difference|error).*detected/.test(lower)
    || /does not affect (the )?factual (layout|content)/.test(lower)
    || /remains consistent with (the )?original/.test(lower)
    || /matches (the )?(original|source)/.test(lower)
    || /расхождени[йя] не (обнаружено|выявлено)/i.test(value)
    || /соответствует исходнику/i.test(value);
};

function quotedToken(value: string): string | null {
  return value.match(/["'«“‘]([^"'»”’]{1,40})["'»”’]/)?.[1] ?? null;
}

export function localizeQaMessage(value: string, kind: "error" | "warning"): string | null {
  const message = value.trim();
  if (!message || isPositiveObservation(message)) return null;
  if (hasCyrillic(message)) return message;
  const lower = message.toLowerCase();
  if (/hallucin|unsupported|unreadable|invented|fabricat/.test(lower)) {
    const token = quotedToken(message);
    return token
      ? `Обнаружена неподтверждённая или нечитаемая подпись «${token}». Её необходимо удалить.`
      : "Обнаружены неподтверждённые подписи, числа или элементы. Их необходимо удалить.";
  }
  if (/geometry|geometric|topology|room count|layout/.test(lower)) return "Обнаружено расхождение геометрии или конфигурации помещений.";
  if (/window/.test(lower)) return "Обнаружено расхождение в расположении или количестве окон.";
  if (/door|opening|swing/.test(lower)) return "Обнаружено расхождение дверей, проёмов или направлений открывания.";
  if (/wall/.test(lower)) return "Обнаружено расхождение стен относительно исходника.";
  if (/area|dimension|label|annotation|number|text/.test(lower)) return "Обнаружено расхождение в подписях, площадях или размерах.";
  if (/style|stylistic|render|visual|cleaner|normalization/.test(lower)) {
    return kind === "warning" ? "Оформление результата отличается от выбранного референса." : "Результат не соответствует выбранному оформлению.";
  }
  return kind === "error" ? "Автоматическая проверка обнаружила расхождение с исходником." : "Результат требует дополнительной визуальной проверки.";
}

export function normalizeFloorPlanQa(value: FloorPlanQa): FloorPlanQa {
  const errors = value.errors.map((message) => localizeQaMessage(message, "error")).filter((message): message is string => Boolean(message));
  const warnings = value.warnings.map((message) => localizeQaMessage(message, "warning")).filter((message): message is string => Boolean(message));
  const checks = Object.fromEntries(Object.entries(value.checks).map(([key, check]) => [key, {
    ...check,
    details: check.passed ? "Проверка пройдена." : `Обнаружено расхождение: ${checkLabels[key as keyof FloorPlanQa["checks"]]}.`,
  }])) as FloorPlanQa["checks"];
  const allChecksPassed = Object.values(checks).every((check) => check.passed);
  return { ...value, errors, warnings, checks, passed: value.passed && value.score >= 0.9 && errors.length === 0 && allChecksPassed };
}
