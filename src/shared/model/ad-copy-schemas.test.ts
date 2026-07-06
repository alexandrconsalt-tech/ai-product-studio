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

describe("AdCopyBenefitsSchema (stage 3, Агент извлечения преимуществ)", () => {
  const valid = {
    advantages: ["панорамные окна", "рядом парк"],
    usp: "Единственная квартира в доме с видом на парк на 12 этаже",
    strengths: ["локация", "инфраструктура"],
    selling_points: ["рядом школа", "два санузла"],
    target_audience: ["Семьи с детьми"],
  };

  it("accepts a full valid shape", () => {
    expect(AdCopyBenefitsSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty advantages list", () => {
    expect(AdCopyBenefitsSchema.safeParse({ ...valid, advantages: [] }).success).toBe(false);
  });

  it("rejects a missing usp", () => {
    const { usp, ...invalid } = valid;
    expect(AdCopyBenefitsSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an empty target_audience list", () => {
    expect(AdCopyBenefitsSchema.safeParse({ ...valid, target_audience: [] }).success).toBe(false);
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

describe("AdCopyQualityCheckSchema (stage 6, Проверка объявления)", () => {
  const valid = {
    facts_ok: true,
    style_ok: true,
    language_ok: true,
    prohibited_words_ok: true,
    readability_score: 82,
    seo_ok: true,
    duplicates_ok: true,
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
});
