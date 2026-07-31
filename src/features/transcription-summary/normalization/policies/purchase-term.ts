import { PURCHASE_TERM_VALUES } from "../../contracts/canonical-enums";
import type { NormalizationPolicy } from "../types";

export const PURCHASE_TERM_POLICY: NormalizationPolicy = Object.freeze({
  id: "normalization.purchase-term.v3",
  version: "3.0.0",
  contractIds: ["needs.agent.output.v3"],
  fieldPath: "structured_crm_attributes.purchase_term.value",
  mode: "alias",
  canonicalValues: PURCHASE_TERM_VALUES,
  ambiguousInputs: ["скоро", "не срочно", "как получится"],
  rules: [
    { id: "term.up-to-one.within", input: "в течение месяца", output: "до 1 месяца", caseSensitive: false, description: "Формальный срок в пределах месяца." },
    { id: "term.up-to-one.one", input: "1 месяц", output: "до 1 месяца", caseSensitive: false, description: "Формальный срок один месяц." },
    { id: "term.up-to-one.before", input: "до месяца", output: "до 1 месяца", caseSensitive: false, description: "Формальный срок до месяца." },
    { id: "term.two-three.words", input: "два-три месяца", output: "2–3 месяца", caseSensitive: false, description: "Словесный диапазон два-три месяца." },
    { id: "term.two-three.hyphen", input: "2-3 месяца", output: "2–3 месяца", caseSensitive: false, description: "Диапазон с дефисом." },
    { id: "term.two-three.spaced-dash", input: "2 — 3 месяца", output: "2–3 месяца", caseSensitive: false, description: "Диапазон с пробелами вокруг тире." },
    { id: "term.three-six.hyphen", input: "3-6 месяцев", output: "3–6 месяцев", caseSensitive: false, description: "Диапазон с дефисом." },
    { id: "term.three-six.spaced-dash", input: "3 — 6 месяцев", output: "3–6 месяцев", caseSensitive: false, description: "Диапазон с пробелами вокруг тире." },
    { id: "term.over-six.more", input: "больше 6 месяцев", output: "более 6 месяцев", caseSensitive: false, description: "Формальный вариант срока более шести месяцев." },
    { id: "term.over-six.above", input: "свыше 6 месяцев", output: "более 6 месяцев", caseSensitive: false, description: "Формальный вариант срока свыше шести месяцев." },
  ],
});
