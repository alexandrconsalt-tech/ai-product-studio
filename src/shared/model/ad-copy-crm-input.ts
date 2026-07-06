import { z } from "zod";

/**
 * Single input contract for the "Генерация текстов объявлений" (Ad Copy
 * Generation) pipeline, matching exactly what the platform actually
 * sends: two top-level blocks, `property` (the listing's structured
 * facts) and `user_settings` (how the user wants the copy generated).
 * Every stage in `ad-copy-test-bench.ts` reads from this one shape
 * (`ctx.normalized` downstream) -- there is deliberately no second,
 * parallel `crm_data`/`property_data` structure anywhere in the
 * pipeline.
 *
 * Field names are English snake_case, not Russian, on purpose (unlike
 * `call-analysis-summary.ts`'s Cyrillic output-only field names): these
 * fields ARE consumed as `{{...}}` prompt template paths by downstream
 * `llm` stages, and `prompt-registry.ts`'s `VARIABLE_PATTERN` only
 * matches ASCII `[a-z][a-z0-9_]*`.
 *
 * Both blocks use `.passthrough()`: the platform is free to add new
 * fields over time (extra property attributes, new user_settings
 * knobs) without the validator hard-failing on them. Only the two
 * fields genuinely essential to know what's being generated at all
 * (`deal_type`, `property_type`) are required -- every other property
 * field, including `price`, is optional by design so a listing missing
 * non-essential data never fails validation.
 */

export const AdCopyPropertySchema = z
  .object({
    deal_type: z.string().min(1),
    property_type: z.string().min(1),
    address: z.string().optional(),
    market_type: z.string().optional(),
    rooms: z.number().optional(),
    floor: z.number().optional(),
    floors_total: z.number().optional(),
    total_area: z.number().optional(),
    living_area: z.number().optional(),
    kitchen_area: z.number().optional(),
    ceiling_height: z.number().optional(),
    renovation: z.string().optional(),
    bathrooms: z.number().optional(),
    loggias: z.number().optional(),
    rooms_isolated: z.boolean().optional(),
    windows: z.array(z.string()).optional(),
    building_material: z.string().optional(),
    heating: z.string().optional(),
    year_built: z.number().optional(),
    price: z.number().optional(),
  })
  .passthrough();

export type AdCopyProperty = z.infer<typeof AdCopyPropertySchema>;

export const AdCopyUserSettingsSchema = z
  .object({
    style: z.string().optional(),
    focus: z.array(z.string()).optional(),
    text_length: z.object({ min_characters: z.number().optional(), max_characters: z.number().optional() }).optional(),
    target_audience: z.array(z.string()).optional(),
    structure: z.string().optional(),
    emoji: z.boolean().optional(),
  })
  .passthrough();

export type AdCopyUserSettings = z.infer<typeof AdCopyUserSettingsSchema>;

export const AdCopyPipelineInputSchema = z.object({
  property: AdCopyPropertySchema,
  user_settings: AdCopyUserSettingsSchema.optional().default({}),
});

export type AdCopyPipelineInput = z.infer<typeof AdCopyPipelineInputSchema>;

/** Realistic example used as the Playground run's default input and in Product Assist context. */
export const AD_COPY_INPUT_EXAMPLE: AdCopyPipelineInput = {
  property: {
    deal_type: "Продать",
    property_type: "Квартира",
    address: "Россия, Санкт-Петербург, Кирилловская улица, 22",
    market_type: "Вторичка",
    rooms: 3,
    floor: 1,
    floors_total: 6,
    total_area: 93,
    living_area: 55,
    kitchen_area: 13.4,
    ceiling_height: 3,
    renovation: "Евро",
    bathrooms: 2,
    loggias: 2,
    rooms_isolated: true,
    windows: ["На улицу", "Во двор"],
    building_material: "Кирпично-монолитный",
    heating: "Индивидуальный котел",
    year_built: 1988,
  },
  user_settings: {
    style: "Профессиональный",
    focus: ["Площадь", "Планировка", "Ремонт", "Инфраструктура"],
    text_length: { min_characters: 1000, max_characters: 2000 },
    target_audience: ["Семьи с детьми", "Пары без детей"],
    structure: "Список с заголовками",
    emoji: false,
  },
};
