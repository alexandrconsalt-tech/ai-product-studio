export type SummaryV2GoldenCase = Readonly<{
  id: string;
  transcript: string;
  expected: Readonly<{
    keyFacts: readonly string[];
    requirements: readonly string[];
    outcome: string;
    nextStepStatus: "CONFIRMED" | "CONDITIONAL" | "PROPOSED" | "NOT_DEFINED";
    interestedIn: readonly ("Новостройки" | "Ипотека" | "Строительство")[];
    fundingSource: "наличные / депозит" | "ипотека одобрена" | "ипотека в процессе" | "продажа своей квартиры" | "не определено";
    purchaseTimeline: "до 1 месяца" | "2–3 месяца" | "3–6 месяцев" | "более 6 месяцев" | "не определено";
    requiredSummaryElements: readonly string[];
    forbiddenErrors: readonly string[];
  }>;
}>;

const commonForbidden = ["выдуманный следующий шаг", "выдуманная сумма", "перепутаны роли", "ложный срок покупки"] as const;

const baseCases: readonly Omit<SummaryV2GoldenCase, "id">[] = [
  {
    transcript: "Клиент: Ищу новостройку до 8 млн. Ипотека одобрена. Агент: Сегодня пришлю варианты. Клиент: Хорошо, пришлите.",
    expected: { keyFacts: ["до 8 млн", "ипотека одобрена"], requirements: ["новостройка"], outcome: "FOLLOW_UP_REQUIRED", nextStepStatus: "CONFIRMED", interestedIn: ["Новостройки"], fundingSource: "ипотека одобрена", purchaseTimeline: "не определено", requiredSummaryElements: ["новостройка", "варианты"], forbiddenErrors: commonForbidden },
  },
  {
    transcript: "Агент: Нужна ипотека? Клиент: Нет, ипотека не нужна, пока только смотрю. Если решу, свяжусь сам.",
    expected: { keyFacts: ["ипотека не нужна"], requirements: [], outcome: "INFORMATION_PROVIDED", nextStepStatus: "NOT_DEFINED", interestedIn: [], fundingSource: "не определено", purchaseTimeline: "не определено", requiredSummaryElements: ["сам свяжется"], forbiddenErrors: [...commonForbidden, "интерес Ипотека"] },
  },
  {
    transcript: "Клиент: Пришлите планировку. Агент: Если подойдёт, тогда договоримся о просмотре. Клиент: По просмотру решу после изучения.",
    expected: { keyFacts: ["нужна планировка"], requirements: ["планировка"], outcome: "FOLLOW_UP_REQUIRED", nextStepStatus: "CONDITIONAL", interestedIn: [], fundingSource: "не определено", purchaseTimeline: "не определено", requiredSummaryElements: ["планировка", "услов"], forbiddenErrors: [...commonForbidden, "просмотр назначен"] },
  },
  {
    transcript: "Клиент: Бюджет от 6 до 7 миллионов, первый взнос 2 миллиона, ипотека в процессе. Купить хочу за 2–3 месяца.",
    expected: { keyFacts: ["6–7 млн", "первый взнос 2 млн"], requirements: [], outcome: "INFORMATION_PROVIDED", nextStepStatus: "NOT_DEFINED", interestedIn: ["Ипотека"], fundingSource: "ипотека в процессе", purchaseTimeline: "2–3 месяца", requiredSummaryElements: ["6", "7"], forbiddenErrors: [...commonForbidden, "смешение бюджета и первого взноса"] },
  },
  {
    transcript: "Клиент: Сначала продам свою квартиру, на эти деньги буду покупать. Агент: Подготовлю консультацию. Клиент: Договорились.",
    expected: { keyFacts: ["продажа своей квартиры"], requirements: [], outcome: "FOLLOW_UP_REQUIRED", nextStepStatus: "CONFIRMED", interestedIn: [], fundingSource: "продажа своей квартиры", purchaseTimeline: "не определено", requiredSummaryElements: ["продаж"], forbiddenErrors: commonForbidden },
  },
  {
    transcript: "Клиент: Хочу построить дом. Бюджет пока не определил. Агент: Можем обсудить проекты. Клиент: Пока не готов договариваться.",
    expected: { keyFacts: ["бюджет не определён"], requirements: ["строительство дома"], outcome: "INFORMATION_PROVIDED", nextStepStatus: "NOT_DEFINED", interestedIn: ["Строительство"], fundingSource: "не определено", purchaseTimeline: "не определено", requiredSummaryElements: ["дом"], forbiddenErrors: commonForbidden },
  },
  {
    transcript: "Оператор: Соединяю с агентом. Агент: Добрый день. Клиент: Нужна квартира у метро. Агент: Уточню варианты и перезвоню завтра. Клиент: Хорошо.",
    expected: { keyFacts: ["квартира у метро"], requirements: ["у метро"], outcome: "FOLLOW_UP_REQUIRED", nextStepStatus: "CONFIRMED", interestedIn: [], fundingSource: "не определено", purchaseTimeline: "не определено", requiredSummaryElements: ["метро", "перезвон"], forbiddenErrors: commonForbidden },
  },
  {
    transcript: "Оператор: Абонент недоступен, соединение не установлено.",
    expected: { keyFacts: [], requirements: [], outcome: "NO_CONNECTION", nextStepStatus: "NOT_DEFINED", interestedIn: [], fundingSource: "не определено", purchaseTimeline: "не определено", requiredSummaryElements: ["не удалось связаться"], forbiddenErrors: commonForbidden },
  },
  {
    transcript: "Клиент: Рассматриваю две локации — Центр и Север. Агент: Отправить подборку? Клиент: Пока не нужно.",
    expected: { keyFacts: ["Центр", "Север"], requirements: ["две локации"], outcome: "INFORMATION_PROVIDED", nextStepStatus: "NOT_DEFINED", interestedIn: [], fundingSource: "не определено", purchaseTimeline: "не определено", requiredSummaryElements: ["Центр", "Север"], forbiddenErrors: commonForbidden },
  },
  {
    transcript: "Клиент: Объект стоит 9 млн, но мой бюджет только 7 млн. Агент: Понял.",
    expected: { keyFacts: ["бюджет 7 млн", "стоимость объекта 9 млн"], requirements: [], outcome: "INFORMATION_PROVIDED", nextStepStatus: "NOT_DEFINED", interestedIn: [], fundingSource: "не определено", purchaseTimeline: "не определено", requiredSummaryElements: ["7 млн"], forbiddenErrors: [...commonForbidden, "бюджет 9 млн"] },
  },
  {
    transcript: "Агент: Просмотр возможен 15 августа. Клиент: Дату просмотра понял, срок покупки пока не знаю.",
    expected: { keyFacts: ["срок покупки не определён"], requirements: [], outcome: "INFORMATION_PROVIDED", nextStepStatus: "PROPOSED", interestedIn: [], fundingSource: "не определено", purchaseTimeline: "не определено", requiredSummaryElements: ["срок не определён"], forbiddenErrors: [...commonForbidden, "15 августа как срок покупки"] },
  },
  {
    transcript: "Клиент: Куплю за наличные с депозита в течение месяца. Агент: Назначим просмотр на субботу? Клиент: Да, в субботу в 12.",
    expected: { keyFacts: ["наличные с депозита"], requirements: [], outcome: "VIEWING_SCHEDULED", nextStepStatus: "CONFIRMED", interestedIn: [], fundingSource: "наличные / депозит", purchaseTimeline: "до 1 месяца", requiredSummaryElements: ["суббот", "12"], forbiddenErrors: commonForbidden },
  },
  {
    transcript: "Клиент: Спасибо, объект не подходит из-за шума, дальше не рассматриваю. Агент: Понял.",
    expected: { keyFacts: ["не подходит из-за шума"], requirements: [], outcome: "CLIENT_DECLINED", nextStepStatus: "NOT_DEFINED", interestedIn: [], fundingSource: "не определено", purchaseTimeline: "не определено", requiredSummaryElements: ["отказ", "шум"], forbiddenErrors: commonForbidden },
  },
  {
    transcript: "Клиент: Интересует консультация по ипотеке, заявку ещё не подавал. Агент: Пришлю список документов. Клиент: Да.",
    expected: { keyFacts: ["заявка не подана"], requirements: ["консультация по ипотеке"], outcome: "FOLLOW_UP_REQUIRED", nextStepStatus: "CONFIRMED", interestedIn: ["Ипотека"], fundingSource: "не определено", purchaseTimeline: "не определено", requiredSummaryElements: ["документ"], forbiddenErrors: [...commonForbidden, "ипотека в процессе"] },
  },
  {
    transcript: "Клиент: Нужна квартира через год, пока собираю информацию. Агент: Отправлю обзор районов. Клиент: Хорошо.",
    expected: { keyFacts: ["покупка через год"], requirements: ["обзор районов"], outcome: "FOLLOW_UP_REQUIRED", nextStepStatus: "CONFIRMED", interestedIn: [], fundingSource: "не определено", purchaseTimeline: "более 6 месяцев", requiredSummaryElements: ["год", "обзор"], forbiddenErrors: commonForbidden },
  },
] as const;

export const SUMMARY_V2_GOLDEN_DATASET: readonly SummaryV2GoldenCase[] = [
  ...baseCases.map((item, index) => ({ id: `golden-${String(index + 1).padStart(2, "0")}`, ...item })),
  ...baseCases.map((item, index) => ({ id: `golden-${String(index + 16).padStart(2, "0")}`, ...item, transcript: `${item.transcript}\nАгент: Спасибо за разговор.` })),
];
