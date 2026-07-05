import { describe, expect, it } from "vitest";
import { AD_COPY_CRM_INPUT_EXAMPLE, AdCopyCrmInputSchema } from "./ad-copy-crm-input";
import { AdCopyBenefitsSchema } from "./ad-copy-benefits";
import { AdCopySchema } from "./ad-copy-output";
import { AdCopyQualityCheckSchema } from "./ad-copy-quality-check";

describe("AdCopyCrmInputSchema (Ad Copy Generation demo pipeline, stage 1/2)", () => {
  it("accepts the realistic example used to seed Playground's default input", () => {
    expect(AdCopyCrmInputSchema.safeParse(AD_COPY_CRM_INPUT_EXAMPLE).success).toBe(true);
  });

  it("accepts the minimal required fields without the optional ones", () => {
    const minimal = { deal_type: "rent", object_type: "квартира", city: "Казань", rooms: 1, area: 32, price: 45000 };
    expect(AdCopyCrmInputSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects an undocumented deal_type", () => {
    expect(AdCopyCrmInputSchema.safeParse({ ...AD_COPY_CRM_INPUT_EXAMPLE, deal_type: "lease" }).success).toBe(false);
  });

  it("rejects a non-positive price", () => {
    expect(AdCopyCrmInputSchema.safeParse({ ...AD_COPY_CRM_INPUT_EXAMPLE, price: 0 }).success).toBe(false);
  });
});

describe("AdCopyBenefitsSchema (stage 3, Агент извлечения преимуществ)", () => {
  const valid = {
    advantages: ["панорамные окна", "рядом парк"],
    usp: "Единственная квартира в доме с видом на парк на 12 этаже",
    strengths: ["локация", "инфраструктура"],
    target_audience: "Семьи с детьми",
    selling_points: ["рядом школа", "два санузла"],
    style: "деловой",
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
