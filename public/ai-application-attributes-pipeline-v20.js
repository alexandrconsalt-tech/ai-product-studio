(() => {
  const config = window.__AI_APPLICATION_ATTRIBUTES_PIPELINE_CONFIG__;
  if (!config || !Array.isArray(config.stages)) return;

  const schema = Object.freeze({
    type: "object",
    additionalProperties: false,
    required: [
      "detected",
      "next_contact_at",
      "precision",
      "action",
      "actor",
      "raw_time_expression",
      "evidence",
      "confidence",
    ],
    properties: {
      detected: { type: "boolean" },
      next_contact_at: { type: ["string", "null"] },
      precision: { type: "string", enum: ["exact", "daypart", "date", "none"] },
      action: { type: "string", enum: ["callback", "message", "send_information", "confirm", "other", "none"] },
      actor: { type: "string", enum: ["agent", "none"] },
      raw_time_expression: { type: ["string", "null"] },
      evidence: { type: ["string", "null"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
  });

  window.__AI_APPLICATION_ATTRIBUTES_NEXT_CONTACT_DATE_SCHEMA_V1__ = schema;

  const stage = config.stages.find((item) => item.outKey === "next_contact_date_extractor");
  if (!stage) return;
  stage.responseContract = "application_next_contact_date_extractor_v1";
  config.revision = 20;
})();
