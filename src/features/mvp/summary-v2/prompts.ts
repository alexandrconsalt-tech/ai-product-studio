import type { JudgeCriterion } from "./contracts";

export const PROMPT_VERSIONS = {
  extractor: "call-intelligence-prompt-v1",
  verifier: "evidence-verifier-prompt-v1",
  generator: "summary-generator-prompt-v1",
  faithfulness: "faithfulness-judge-prompt-v1",
  completeness: "completeness-judge-prompt-v1",
  usefulness: "usefulness-judge-prompt-v1",
  agreements_next_step: "agreements-judge-prompt-v1",
  format: "format-judge-prompt-v1",
} as const;

const evidenceRule = `Каждый содержательный элемент обязан ссылаться на дословную короткую цитату и turn_id. Единственный источник фактов — транскрипция. Не делай выводов по косвенным признакам. Слова агента не являются позицией клиента. Условное или предложенное действие не является подтверждённой договорённостью.`;

export function extractorPrompt(transcript: string): string {
  return `Ты — Call Intelligence Extractor для звонков по недвижимости. Верни только JSON по переданной JSON Schema.
${evidenceRule}
Справочники:
- interested_in: только "Новостройки", "Ипотека", "Строительство";
- funding_source: "наличные / депозит", "ипотека одобрена", "ипотека в процессе", "продажа своей квартиры", "не определено";
- purchase_timeline: "до 1 месяца", "2–3 месяца", "3–6 месяцев", "более 6 месяцев", "не определено".
Не считай вопрос об ипотеке интересом. Не трактуй дату просмотра как срок покупки. Не смешивай бюджет, ипотеку, первый взнос и продажу своей квартиры.
Транскрипция с turn_id:
${transcript}`;
}

export function verifierPrompt(transcript: string, normalized: unknown): string {
  return `Ты — независимый Evidence Verifier. Не переписывай данные. Для каждого id верни VERIFIED, REJECTED или UNCERTAIN.
${evidenceRule}
Отдельно проверь следующий шаг, outcome и три структурированных атрибута. Цитата должна реально присутствовать в соответствующей реплике.
ТРАНСКРИПЦИЯ:
${transcript}
НОРМАЛИЗОВАННЫЕ ДАННЫЕ:
${JSON.stringify(normalized)}`;
}

export function generatorPrompt(transcript: string, store: unknown): string {
  return `Ты — Summary Generator. Верни только JSON по схеме. Используй только verified из Conversation Store v2; транскрипцию разрешено использовать лишь для выбора точных коротких цитат и проверки формулировки.
Формат результата: overview — 2–4 кратких предложения; key_facts — максимум 4; quotes — максимум 2 дословные полезные цитаты; agreement_next_step — одно предложение либо null.
Не выводи пустые разделы, "не определено", confidence, ID, статусы проверки, технические поля, телефон и дубли карточки CRM. Не придумывай мотив, срочность, срок, канал или следующий шаг.
ТРАНСКРИПЦИЯ:
${transcript}
CONVERSATION STORE V2:
${JSON.stringify(store)}`;
}

const criterionInstructions: Record<JudgeCriterion, string> = {
  faithfulness: "Проверь только достоверность: факты, роли, суммы, даты, сроки, каналы, цитаты и отсутствие выдуманных причинно-следственных связей. При критической ошибке score не выше 60.",
  completeness: "Проверь только полноту критически важной информации именно этого звонка. Не штрафуй за то, чего в разговоре не было. Пропуск главного результата или подтверждённого следующего шага — критическая ошибка.",
  usefulness: "Проверь только практическую полезность для агента: можно ли продолжить работу без прослушивания, понятны ли приоритеты, контекст, незакрытые вопросы и действие.",
  agreements_next_step: "Проверь только итог, договорённости и следующий шаг: действие, ответственный, срок, канал и статус confirmed/conditional/proposed. Не штрафуй за корректное отсутствие шага.",
  format: "Проверь только структуру, краткость, повторы, деловой язык, 3–4 факта максимум, 1–2 цитаты максимум, отсутствие пустых разделов, технических данных и значения «не определено».",
};

export function judgePrompt(criterion: JudgeCriterion, transcript: string, store: unknown, summary: unknown): string {
  return `Ты — независимый Summary Judge. ${criterionInstructions[criterion]}
Оцени только свой критерий. Не переписывай summary и Store. Верни только JSON по схеме с criterion="${criterion}". Не назначай универсальную оценку: score должен следовать конкретным найденным проблемам.
ТРАНСКРИПЦИЯ:
${transcript}
STORE:
${JSON.stringify(store)}
SUMMARY:
${JSON.stringify(summary)}`;
}
