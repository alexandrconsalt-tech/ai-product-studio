import { COMMUNICATION_CHANNEL_VALUES } from "../../contracts/canonical-enums";
import type { NormalizationPolicy } from "../types";

const rules = [
  { id: "channel.whatsapp.display", input: "WhatsApp", output: "whatsapp", caseSensitive: true, description: "Регистровый вариант WhatsApp." },
  { id: "channel.whatsapp.ru", input: "ватсап", output: "whatsapp", caseSensitive: false, description: "Русский формальный alias WhatsApp." },
  { id: "channel.whatsapp.space", input: "whats app", output: "whatsapp", caseSensitive: true, description: "Технический вариант WhatsApp с пробелом." },
  { id: "channel.whatsapp.display-space", input: "Whats App", output: "whatsapp", caseSensitive: true, description: "Регистровый вариант WhatsApp с пробелом." },
  { id: "channel.email.long", input: "электронная почта", output: "email", caseSensitive: false, description: "Русский canonical alias email." },
  { id: "channel.email.hyphen", input: "e-mail", output: "email", caseSensitive: false, description: "Технический вариант email." },
  { id: "channel.email.upper", input: "EMAIL", output: "email", caseSensitive: true, description: "Регистровый технический alias email." },
  { id: "channel.email.mail", input: "почта", output: "email", caseSensitive: false, description: "Утверждённый прямой alias email." },
  { id: "channel.phone.ru", input: "телефон", output: "phone", caseSensitive: false, description: "Русский canonical alias phone." },
  { id: "channel.phone.call", input: "телефонный звонок", output: "phone", caseSensitive: false, description: "Прямой alias телефонного канала." },
  { id: "channel.max.ru", input: "макс", output: "max", caseSensitive: false, description: "Русский технический alias MAX." },
  { id: "channel.max.upper", input: "MAX", output: "max", caseSensitive: true, description: "Регистровый вариант MAX." },
  { id: "channel.max.messenger", input: "мессенджер MAX", output: "max", caseSensitive: false, description: "Полное название канала MAX." },
  { id: "channel.telegram.ru", input: "телеграм", output: "telegram", caseSensitive: false, description: "Русский canonical alias Telegram." },
  { id: "channel.telegram.display", input: "Telegram", output: "telegram", caseSensitive: true, description: "Регистровый вариант Telegram." },
] as const;

export const COMMUNICATION_CHANNEL_POLICIES: readonly NormalizationPolicy[] = Object.freeze([
  {
    id: "normalization.needs.communication-channel.v3",
    version: "3.0.0",
    contractIds: ["needs.agent.output.v3"],
    fieldPath: "communication_preferences.*.channel",
    mode: "alias",
    canonicalValues: COMMUNICATION_CHANNEL_VALUES,
    rules,
  },
  ...[
    "agreements.*.channel",
    "primary_next_step.channel",
    "communication_channel.channel",
  ].map((fieldPath, index) => ({
    id: `normalization.outcome.communication-channel-${index + 1}.v3`,
    version: "3.0.0",
    contractIds: ["outcome.agent.output.v3"],
    fieldPath,
    mode: "alias" as const,
    canonicalValues: COMMUNICATION_CHANNEL_VALUES,
    rules,
  })),
]);
