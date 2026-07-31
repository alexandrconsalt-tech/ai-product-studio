import { INTEREST_VALUES } from "../../contracts/canonical-enums";
import type { NormalizationPolicy } from "../types";

export const NEED_TYPE_POLICY: NormalizationPolicy = Object.freeze({
  id: "normalization.need-types.v3",
  version: "3.0.0",
  contractIds: ["needs.agent.output.v3"],
  fieldPath: "structured_crm_attributes.interested_in.*.value",
  mode: "alias",
  canonicalValues: INTEREST_VALUES,
  rules: [
    { id: "need.new-build.case", input: "новостройки", output: "Новостройки", caseSensitive: true, description: "Регистровый вариант canonical interest." },
    { id: "need.new-build.singular", input: "новостройка", output: "Новостройки", caseSensitive: false, description: "Единственное число canonical interest." },
    { id: "need.mortgage.case", input: "ипотека", output: "Ипотека", caseSensitive: true, description: "Регистровый вариант canonical interest." },
    { id: "need.mortgage.plural", input: "ипотеки", output: "Ипотека", caseSensitive: false, description: "Морфологический вариант canonical interest." },
    { id: "need.mortgage-credit", input: "ипотечное кредитование", output: "Ипотека", caseSensitive: false, description: "Прямой синоним ипотечного интереса." },
    { id: "need.construction.case", input: "строительство", output: "Строительство", caseSensitive: true, description: "Регистровый вариант canonical interest." },
  ],
});
