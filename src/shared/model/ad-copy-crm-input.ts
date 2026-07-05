import { z } from "zod";

/**
 * Structured input contract for the "Генерация текстов объявлений"
 * (Ad Copy Generation) demo pipeline's entry stage ("Валидация входных
 * данных"). Field names are English snake_case, not Russian, on
 * purpose -- unlike `call-analysis-summary.ts`'s Cyrillic field names
 * (which are safe because that schema is only ever a terminal LLM
 * output, never itself re-used as upstream template variables), this
 * schema's fields ARE consumed as `{{snake_case}}` prompt variables by
 * downstream `llm` nodes (see `real-stage.ts`'s `asStringVariables`).
 * `prompt-registry.ts`'s `VARIABLE_PATTERN` only matches ASCII
 * `[a-z][a-z0-9_]*`, so a Cyrillic key could never be referenced in a
 * template at all -- this is a technical constraint, not a style choice.
 */

export const AdCopyDealTypeSchema = z.enum(["sale", "rent"]);
export type AdCopyDealType = z.infer<typeof AdCopyDealTypeSchema>;

export const AdCopyCrmInputSchema = z.object({
  deal_type: AdCopyDealTypeSchema,
  object_type: z.string().min(1),
  city: z.string().min(1),
  district: z.string().optional(),
  street: z.string().optional(),
  rooms: z.number().int().nonnegative(),
  area: z.number().positive(),
  floor: z.number().int().optional(),
  total_floors: z.number().int().optional(),
  price: z.number().positive(),
  description: z.string().optional(),
  features: z.array(z.string()).readonly().optional(),
  renovation: z.string().optional(),
  balcony: z.boolean().optional(),
  bathroom: z.string().optional(),
  view: z.string().optional(),
  infrastructure: z.array(z.string()).readonly().optional(),
  parking: z.string().optional(),
  mortgage: z.boolean().optional(),
  directories: z.record(z.string(), z.string()).optional(),
  generation_settings: z
    .object({
      tone: z.string().optional(),
      length: z.string().optional(),
      platform: z.string().optional(),
    })
    .optional(),
});

export type AdCopyCrmInput = z.infer<typeof AdCopyCrmInputSchema>;

/** Realistic example used as the Playground run's default input and in Product Assist context. */
export const AD_COPY_CRM_INPUT_EXAMPLE: AdCopyCrmInput = {
  deal_type: "sale",
  object_type: "квартира",
  city: "Москва",
  district: "Пресненский",
  street: "Красногвардейский бульвар",
  rooms: 2,
  area: 54.5,
  floor: 12,
  total_floors: 25,
  price: 18500000,
  description: "Светлая квартира с панорамными окнами, рядом парк и метро.",
  features: ["панорамные окна", "два санузла", "кладовая"],
  renovation: "дизайнерский ремонт",
  balcony: true,
  bathroom: "раздельный",
  view: "на парк",
  infrastructure: ["школа", "детский сад", "торговый центр", "метро в 5 минутах"],
  parking: "подземный паркинг",
  mortgage: true,
  directories: { residential_complex: "ЖК Северный Парк", developer: "ПИК" },
  generation_settings: { tone: "деловой", length: "среднее", platform: "Avito" },
};
