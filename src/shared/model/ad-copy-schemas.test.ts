import { describe, expect, it } from "vitest";
import { AD_COPY_INPUT_EXAMPLE, AdCopyPipelineInputSchema } from "./ad-copy-crm-input";
import { AdCopyBenefitsSchema } from "./ad-copy-benefits";
import { AdCopySchema } from "./ad-copy-output";
import { AdCopyQualityCheckSchema } from "./ad-copy-quality-check";

describe("AdCopyPipelineInputSchema ({property, user_settings} -- the pipeline's single input contract)", () => {
  it("accepts the realistic example used to seed Playground's default input", () => {
    expect(AdCopyPipelineInputSchema.safeParse(AD_COPY_INPUT_EXAMPLE).success).toBe(true);
  });

  it("accepts the minimal required fields (deal_type + property_type) without any optional ones", () => {
    const minimal = { property: { deal_type: "Сдать", property_type: "Квартира" } };
    expect(AdCopyPipelineInputSchema.safeParse(minimal).success).toBe(true);
  });

  it("defaults user_settings to {} when the platform omits it", () => {
    const result = AdCopyPipelineInputSchema.safeParse({ property: { deal_type: "Продать", property_type: "Дом" } });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.user_settings).toEqual({});
  });

  it("rejects a property missing property_type", () => {
    expect(AdCopyPipelineInputSchema.safeParse({ property: { deal_type: "Продать" } }).success).toBe(false);
  });

  it("never fails on a missing optional field such as price", () => {
    const { price: _price, ...propertyWithoutPrice } = AD_COPY_INPUT_EXAMPLE.property as Record<string, unknown>;
    expect(AdCopyPipelineInputSchema.safeParse({ property: propertyWithoutPrice, user_settings: AD_COPY_INPUT_EXAMPLE.user_settings }).success).toBe(true);
  });

  it("passes through unknown extra fields instead of failing (the platform may add fields over time)", () => {
    const withExtra = { property: { ...AD_COPY_INPUT_EXAMPLE.property, some_future_field: "x" }, user_settings: AD_COPY_INPUT_EXAMPLE.user_settings };
    expect(AdCopyPipelineInputSchema.safeParse(withExtra).success).toBe(true);
  });
});

describe("AdCopyBenefitsSchema (stage 3, Агент извлечения преимуществ -- готовые выгоды, не характеристики)", () => {
  const valid = {
    usp: "Единственная квартира в доме с видом на парк на 12 этаже",
    advantages: [
      "Панорамные окна дарят много естественного света весь день",
      "Соседство с парком позволяет гулять в двух шагах от дома",
      "Дизайнерский ремонт избавляет от хлопот с обустройством",
    ],
    selling_points: ["рядом школа", "два санузла"],
  };

  it("accepts a full valid shape", () => {
    expect(AdCopyBenefitsSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects fewer than 3 advantages", () => {
    expect(AdCopyBenefitsSchema.safeParse({ ...valid, advantages: valid.advantages.slice(0, 1) }).success).toBe(false);
  });

  it("rejects a raw characteristic instead of a benefit (too short to be a finished sentence)", () => {
    expect(AdCopyBenefitsSchema.safeParse({ ...valid, advantages: ["Две лоджии", "Ремонт", "Санузел"] }).success).toBe(false);
  });

  it("rejects a missing usp", () => {
    const { usp, ...invalid } = valid;
    expect(AdCopyBenefitsSchema.safeParse(invalid).success).toBe(false);
  });

  it("no longer accepts the old strengths/target_audience fields as required (contract simplified to usp/advantages/selling_points only)", () => {
    // Extra unknown fields are simply ignored by a non-strict Zod object, not rejected --
    // the important behavior is that the 3 required fields alone are sufficient.
    expect(AdCopyBenefitsSchema.safeParse({ usp: valid.usp, advantages: valid.advantages, selling_points: valid.selling_points }).success).toBe(true);
  });
});

describe("AdCopySchema (stage 5, Генерация объявления -- Заголовок/Описание/CTA/Confidence)", () => {
  it("accepts the full shape with confidence", () => {
    expect(AdCopySchema.safeParse({ title: "2-комн. квартира у парка", description: "Просторная квартира...", cta: "Записаться на показ", confidence: 0.92 }).success).toBe(true);
  });

  it("accepts without confidence (attached later by the runtime, not the prompt)", () => {
    expect(AdCopySchema.safeParse({ title: "Заголовок", description: "Описание", cta: "Позвоните нам" }).success).toBe(true);
  });

  it("rejects a missing cta", () => {
    expect(AdCopySchema.safeParse({ title: "Заголовок", description: "Описание" }).success).toBe(false);
  });
});

describe("AdCopyQualityCheckSchema (stage 6, Проверка объявления -- production-quality audit: 4 new checks)", () => {
  const valid = {
    facts_ok: true,
    style_ok: true,
    language_ok: true,
    prohibited_words_ok: true,
    ai_cliches_ok: true,
    readability_score: 82,
    seo_ok: true,
    duplicates_ok: true,
    user_settings_ok: true,
    platform_requirements_ok: true,
    title: "2-комн. квартира у парка",
    description: "Просторная квартира с дизайнерским ремонтом.",
    cta: "Записаться на показ",
    issues: [],
  };

  it("accepts a full valid shape with every check reported separately", () => {
    expect(AdCopyQualityCheckSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a readability_score outside 0-100", () => {
    expect(AdCopyQualityCheckSchema.safeParse({ ...valid, readability_score: 140 }).success).toBe(false);
  });

  it("rejects a missing boolean check", () => {
    const { seo_ok, ...invalid } = valid;
    expect(AdCopyQualityCheckSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects a missing ai_cliches_ok (new check for generic AI-sounding boilerplate)", () => {
    const { ai_cliches_ok, ...invalid } = valid;
    expect(AdCopyQualityCheckSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects a missing user_settings_ok / platform_requirements_ok (new semantic checks)", () => {
    const { user_settings_ok, ...invalid } = valid;
    expect(AdCopyQualityCheckSchema.safeParse(invalid).success).toBe(false);
    const { platform_requirements_ok, ...invalid2 } = valid;
    expect(AdCopyQualityCheckSchema.safeParse(invalid2).success).toBe(false);
  });
});
