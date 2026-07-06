import type { Architecture } from "@/entities/Architecture/model/types";
import type { Edge } from "@/entities/Edge/model/types";
import type { Framework } from "@/entities/Framework/model/types";
import type { KnowledgeModule } from "@/entities/KnowledgeModule/model/types";
import type { Model } from "@/entities/Model/model/types";
import type { Node } from "@/entities/Node/model/types";
import type { Pipeline } from "@/entities/Pipeline/model/types";
import type { Product } from "@/entities/Product/model/types";
import type { Project } from "@/entities/Project/model/types";
import type { Prompt } from "@/entities/Prompt/model/types";
import type { Review } from "@/entities/Review/model/types";
import type { Run } from "@/entities/Run/model/types";
import { AD_COPY_INPUT_EXAMPLE } from "@/shared/model/ad-copy-crm-input";
import type { RepositorySnapshot } from "./types";

const createdAt = "2026-06-29T10:00:00.000Z";

const frameworks: Framework[] = [
  { id: "framework_jtbd", name: "JTBD", category: "product_discovery", source: "Senior Product Manager Knowledge System", version: "1.0.0" },
  { id: "framework_prd", name: "PRD", category: "product_discovery", source: "Senior Product Manager Knowledge System", version: "1.0.0" },
  { id: "framework_evaluation", name: "Evaluation Strategy", category: "evaluation", source: "Senior AI Solution Architect Knowledge System", version: "1.0.0" },
  { id: "framework_rag", name: "RAG", category: "ai_engineering", source: "Senior AI Solution Architect Knowledge System", version: "1.0.0" },
];

const knowledgeModules: KnowledgeModule[] = [
  {
    id: "knowledge_spm",
    name: "Senior Product Manager",
    kind: "senior_product_manager",
    path: "skills/senior-product-manager",
    frameworkIds: ["framework_jtbd", "framework_prd"],
    version: "1.0.0",
  },
  {
    id: "knowledge_architect",
    name: "Senior AI Solution Architect",
    kind: "senior_ai_solution_architect",
    path: "skills/senior-ai-solution-architect",
    frameworkIds: ["framework_evaluation", "framework_rag"],
    version: "1.0.0",
  },
];

const models: Model[] = [
  { id: "model_fast", name: "Fast Classifier", provider: "local", capabilities: ["classification", "extraction"], contextWindow: 16000, version: "1.0.0" },
  { id: "model_reasoning", name: "Reasoning LLM", provider: "local", capabilities: ["generation", "reasoning", "tool_use"], contextWindow: 64000, version: "1.0.0" },
  // Real vendor models, distinct from the "local" mock models above --
  // these are the two vendors Pipeline Lab v3 (public/pipeline-lab-v3.html)
  // genuinely calls (via BYOK, §M.11 integration), unlike the rest of the
  // app which only ever calls MockLLMProvider.
  { id: "model_gpt5_mini", name: "GPT-5 mini", provider: "openai", capabilities: ["extraction", "generation"], contextWindow: 128000, version: "1.0.0" },
  { id: "model_claude_sonnet", name: "Claude Sonnet 4.6", provider: "anthropic", capabilities: ["reasoning", "generation"], contextWindow: 200000, version: "1.0.0" },
];

const prompts: Prompt[] = [
  {
    id: "prompt_call_summary",
    name: "Call Summary Behavior",
    purpose: "generation",
    description: "Формирует структурированное summary звонка с потребностями клиента, рисками и next action.",
    status: "ready",
    ownerModuleId: "knowledge_architect",
    version: "1.0.0",
  },
  {
    id: "prompt_quality_check",
    name: "Quality Check Behavior",
    purpose: "evaluation",
    description: "Проверяет полноту, фактичность и применимость результата анализа звонка.",
    status: "ready",
    ownerModuleId: "knowledge_architect",
    version: "1.0.0",
  },
  {
    id: "prompt_lead_qualification",
    name: "Lead Qualification Behavior",
    purpose: "extraction",
    description: "Оценивает входящий лид по платежеспособности и сроку покупки, формирует hotness-score (CLAUDE.md §30 BR-4).",
    status: "ready",
    ownerModuleId: "knowledge_architect",
    version: "1.0.0",
  },
  {
    id: "prompt_chat_classification",
    name: "Chat Classification Behavior",
    purpose: "routing",
    description: "Классифицирует входящее сообщение чата поддержки по категории, тональности и необходимости эскалации.",
    status: "ready",
    ownerModuleId: "knowledge_architect",
    version: "1.0.0",
  },
  // ── Pipeline Lab v3 integration (§M.11) -- same wording as the real
  // prompt bodies in public/pipeline-lab-v3.html's defaultPipeline(),
  // adapted only where that file's own `{{ctx.x}}` template syntax
  // doesn't match this registry's `{{snake_case}}`-only variable regex
  // (prompt-registry.ts) -- `{{ctx.facts}}` becomes `{{facts}}` etc.
  // See seed-prompts.ts for the registered template bodies.
  {
    id: "prompt_pipeline_lab_facts",
    name: "Fact Agent (Pipeline Lab v3)",
    purpose: "extraction",
    description: "Извлекает факты из транскрипции звонка по недвижимости: имя клиента, бюджет, источник средств, район, упоминание телефона -- с цитатами.",
    status: "ready",
    ownerModuleId: "knowledge_architect",
    version: "1.0.0",
  },
  {
    id: "prompt_pipeline_lab_needs",
    name: "Need Agent (Pipeline Lab v3)",
    purpose: "extraction",
    description: "Определяет потребности клиента (тип объекта, требования, срок покупки) из транскрипции звонка по недвижимости.",
    status: "ready",
    ownerModuleId: "knowledge_architect",
    version: "1.0.0",
  },
  {
    id: "prompt_pipeline_lab_outcome",
    name: "Outcome Agent (Pipeline Lab v3)",
    purpose: "extraction",
    description: "Определяет результат звонка (назначен показ, повторный звонок, отказ и т.д.) и следующий шаг.",
    status: "ready",
    ownerModuleId: "knowledge_architect",
    version: "1.0.0",
  },
  {
    id: "prompt_pipeline_lab_summary",
    name: "Summary Agent (Pipeline Lab v3)",
    purpose: "generation",
    description: "Формирует саммари звонка для карточки CRM на основе фактов/потребностей/результата -- без телефонов, адресов и сумм в тексте.",
    status: "ready",
    ownerModuleId: "knowledge_architect",
    version: "1.0.0",
  },
  {
    id: "prompt_pipeline_lab_check",
    name: "Check Agent (Pipeline Lab v3, cross-vendor)",
    purpose: "evaluation",
    description: "Независимая (другой вендор) проверка саммари на галлюцинации и утечку PII относительно данных хранилища и транскрипции.",
    status: "ready",
    ownerModuleId: "knowledge_architect",
    version: "1.0.0",
  },
  // ── "Генерация текстов объявлений" (Ad Copy Generation) demo pipeline ──
  {
    id: "prompt_ad_benefits",
    name: "Benefit Extraction Agent (Генерация текстов объявлений)",
    purpose: "extraction",
    description: "Определяет преимущества объекта недвижимости, УТП, сильные стороны, целевую аудиторию, продающие тезисы и стиль объявления по данным CRM.",
    status: "ready",
    ownerModuleId: "knowledge_architect",
    version: "1.0.0",
  },
  {
    id: "prompt_ad_generation",
    name: "Ad Generation Agent (Генерация текстов объявлений)",
    purpose: "generation",
    description: "Генерирует Title/Description/CTA продающего объявления на основе данных объекта, преимуществ и правил компании.",
    status: "ready",
    ownerModuleId: "knowledge_architect",
    version: "1.0.0",
  },
  {
    id: "prompt_ad_checker",
    name: "Self-Check Agent (Генерация текстов объявлений)",
    purpose: "review",
    description: "Самопроверка готового объявления: факты, стиль, русский язык, запрещённые слова, читаемость, SEO, повторы -- с исправлением найденных ошибок.",
    status: "ready",
    ownerModuleId: "knowledge_architect",
    version: "1.0.0",
  },
];

const product: Product = {
  id: "product_demo_call_analysis",
  projectId: "project_demo_call_analysis",
  status: "ready",
  idea: {
    statement: "AI Call Analysis помогает Product и Sales командам автоматически извлекать потребности, риски и next steps из клиентских звонков.",
    source: "Demo Project",
  },
  discovery:
    "Команды теряют контекст звонков и вручную переносят заметки в CRM. Основной pain — неполные summary, позднее обновление сделки и отсутствие единого качества follow-up.",
  problem: {
    statement: "После клиентских звонков важные сигналы о потребностях и рисках теряются или фиксируются слишком поздно.",
    evidenceIds: ["evidence_demo_interviews", "evidence_demo_sales_notes"],
  },
  users: [
    { id: "user_sales_manager", name: "Sales Manager", segment: "B2B Sales" },
    { id: "user_product_manager", name: "Product Manager", segment: "Customer Insights" },
  ],
  jtbd: [
    {
      statement: "Когда завершился клиентский звонок, я хочу быстро получить надежное summary, чтобы обновить сделку и передать next steps без потери контекста.",
      context: "После звонка с потенциальным клиентом",
      desiredOutcome: "CRM обновлена быстрее, next step не потерян",
    },
  ],
  features: [
    { id: "feature_transcript_analysis", name: "Transcript Analysis", description: "Извлечение summary, потребностей и рисков из transcript.", priority: "high" },
    { id: "feature_quality_review", name: "Quality Review", description: "Проверка результата перед сохранением.", priority: "medium" },
  ],
  mvp: "Загрузка transcript, анализ потребностей и рисков, validation, human review для low-confidence случаев, run history в Playground.",
  metrics: [
    { name: "Time to CRM update", target: "-50%" },
    { name: "Summary completeness", target: ">= 85%" },
    { name: "Human correction rate", target: "<= 20%" },
  ],
  prd:
    "AI Call Analysis MVP принимает текст звонка, выделяет summary, потребности клиента, objections, risk signals и recommended next action. Результат должен быть structured, проверяемым и готовым для human review.",
  frameworkIds: ["framework_jtbd", "framework_prd"],
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

const architecture: Architecture = {
  id: "architecture_demo_call_analysis",
  projectId: "project_demo_call_analysis",
  productId: "product_demo_call_analysis",
  status: "ready",
  capabilities: [
    { id: "cap_ingest", name: "Transcript Ingestion", description: "Прием transcript звонка.", required: true },
    { id: "cap_extract", name: "Need and Risk Extraction", description: "Извлечение потребностей, objections и risks.", required: true },
    { id: "cap_review", name: "Human Review", description: "Проверка low-confidence результата.", required: true },
  ],
  aiComponents: [
    { id: "component_router", name: "Call Type Router", type: "workflow", description: "Определяет путь обработки." },
    { id: "component_llm", name: "Call Analyzer LLM", type: "llm", description: "Формирует structured analysis." },
    { id: "component_validator", name: "Quality Validator", type: "rules_engine", description: "Проверяет полноту и confidence." },
    { id: "component_human_review", name: "Human Review Queue", type: "human_review", description: "Получает low-confidence outputs." },
  ],
  modelIds: ["model_fast", "model_reasoning"],
  dataFlow: [
    { id: "flow_input", source: "Input", target: "Call Type Router", dataType: "transcript" },
    { id: "flow_analysis", source: "Call Analyzer LLM", target: "Quality Validator", dataType: "structured_analysis" },
    { id: "flow_output", source: "Quality Validator", target: "Output", dataType: "approved_result" },
  ],
  quality: [
    { name: "Schema validity", threshold: "100%" },
    { name: "Summary completeness", threshold: ">= 85%" },
    { name: "Human review trigger", threshold: "confidence < 0.72" },
  ],
  evaluation: [
    { metric: "Field accuracy", method: "Demo evaluator", threshold: ">= 0.85" },
    { metric: "Latency", method: "Simulation", threshold: "< 2000ms" },
    { metric: "Cost", method: "Token estimate", threshold: "< $0.05/run" },
  ],
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

const nodes: Node[] = [
  { id: "node_input", type: "input", name: "Call Transcript", description: "Текст звонка клиента.", inputPorts: [], outputPorts: [{ id: "port_input_out", name: "transcript" }], tools: [], metadata: { stage: "ingest" }, position: { x: 0, y: 120 }, version: "1.0.0" },
  { id: "node_router", type: "router", name: "Call Type Router", description: "Определяет тип звонка и route.", inputPorts: [{ id: "port_router_in", name: "transcript" }], outputPorts: [{ id: "port_router_out", name: "routed transcript" }], modelId: "model_fast", temperature: 0.1, tools: [], metadata: { route: "sales_call" }, position: { x: 260, y: 120 }, version: "1.0.0" },
  { id: "node_llm", type: "llm", name: "Need Extractor", description: "Извлекает summary, needs, risks и next action.", inputPorts: [{ id: "port_llm_in", name: "routed transcript" }], outputPorts: [{ id: "port_llm_out", name: "analysis" }], modelId: "model_reasoning", promptId: "prompt_call_summary", temperature: 0.3, tools: ["schema-validator"], metadata: { output: "structured" }, position: { x: 540, y: 80 }, version: "1.0.0" },
  { id: "node_tool", type: "tool", name: "CRM Context Tool", description: "Подмешивает справочный контекст сделки.", inputPorts: [{ id: "port_tool_in", name: "account id" }], outputPorts: [{ id: "port_tool_out", name: "crm context" }], tools: ["crm-lookup"], metadata: { mode: "read-only" }, position: { x: 540, y: 260 }, version: "1.0.0" },
  { id: "node_validation", type: "validation", name: "Quality Validator", description: "Проверяет schema, полноту и confidence.", inputPorts: [{ id: "port_validation_in", name: "analysis" }], outputPorts: [{ id: "port_validation_ok", name: "approved" }, { id: "port_validation_review", name: "needs review" }], promptId: "prompt_quality_check", temperature: 0, tools: ["schema-validator"], metadata: { threshold: "0.72" }, position: { x: 850, y: 120 }, version: "1.0.0" },
  { id: "node_review", type: "human_review", name: "Human Review", description: "Проверка low-confidence результатов.", inputPorts: [{ id: "port_review_in", name: "needs review" }], outputPorts: [{ id: "port_review_out", name: "reviewed" }], tools: [], metadata: { sla: "15m" }, position: { x: 1140, y: 260 }, version: "1.0.0" },
  { id: "node_store", type: "store", name: "Result Store", description: "Сохраняет approved result и run metadata.", inputPorts: [{ id: "port_store_in", name: "approved" }], outputPorts: [{ id: "port_store_out", name: "stored result" }], tools: [], metadata: { retention: "90d" }, position: { x: 1140, y: 80 }, version: "1.0.0" },
  { id: "node_output", type: "output", name: "Call Analysis Output", description: "Финальный structured output.", inputPorts: [{ id: "port_output_in", name: "stored result" }], outputPorts: [], tools: [], metadata: { format: "json" }, position: { x: 1420, y: 120 }, version: "1.0.0" },
];

const edges: Edge[] = [
  { id: "edge_input_router", sourceNodeId: "node_input", targetNodeId: "node_router", sourcePortId: "port_input_out", targetPortId: "port_router_in", version: "1.0.0" },
  { id: "edge_router_llm", sourceNodeId: "node_router", targetNodeId: "node_llm", sourcePortId: "port_router_out", targetPortId: "port_llm_in", version: "1.0.0" },
  { id: "edge_tool_llm", sourceNodeId: "node_tool", targetNodeId: "node_llm", sourcePortId: "port_tool_out", targetPortId: "port_llm_in", version: "1.0.0" },
  { id: "edge_llm_validation", sourceNodeId: "node_llm", targetNodeId: "node_validation", sourcePortId: "port_llm_out", targetPortId: "port_validation_in", version: "1.0.0" },
  { id: "edge_validation_store", sourceNodeId: "node_validation", targetNodeId: "node_store", sourcePortId: "port_validation_ok", targetPortId: "port_store_in", condition: { field: "confidence", operator: "gte", value: 0.72 }, version: "1.0.0" },
  { id: "edge_validation_review", sourceNodeId: "node_validation", targetNodeId: "node_review", sourcePortId: "port_validation_review", targetPortId: "port_review_in", condition: { field: "confidence", operator: "lt", value: 0.72 }, version: "1.0.0" },
  { id: "edge_review_store", sourceNodeId: "node_review", targetNodeId: "node_store", sourcePortId: "port_review_out", targetPortId: "port_store_in", version: "1.0.0" },
  { id: "edge_store_output", sourceNodeId: "node_store", targetNodeId: "node_output", sourcePortId: "port_store_out", targetPortId: "port_output_in", version: "1.0.0" },
];

const pipeline: Pipeline = {
  id: "pipeline_demo_call_analysis",
  projectId: "project_demo_call_analysis",
  architectureId: "architecture_demo_call_analysis",
  status: "ready",
  nodes,
  edges,
  layout: { viewport: { x: 0, y: 0, zoom: 0.85 } },
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

/**
 * Second demo pipeline -- Lead Qualification (CLAUDE.md §3.3/§30 BR-4:
 * "Priority/'hotness' scoring for a lead combines exactly three
 * signals: client solvency, purchase timeline, and a system-computed
 * hotness score"). Reuses the real business domain from the call-
 * analysis case rather than an invented generic example, per the
 * decision rule in §3.4. Deliberately simpler than the first pipeline
 * (no dedicated Validation node -- `real-stage.ts`'s deterministic
 * validation only recognizes `CallAnalysisSummarySchema`, so a
 * `validation` node here would always show `validated: false`, which
 * would look like a bug rather than the honest "no schema written for
 * this domain yet" state it actually is). Branches directly on the
 * `confidence` metric every `llm`/`agent` stage output carries
 * (`real-stage.ts`'s `createLlmHandler`), the same universal field the
 * first pipeline branches on.
 */
const productLead: Product = {
  id: "product_demo_lead_qualification",
  projectId: "project_demo_lead_qualification",
  status: "ready",
  idea: {
    statement: "Lead Qualification автоматически приоритизирует входящие лиды по платежеспособности и сроку покупки, убирая субъективность ручной оценки.",
    source: "pdf-notes.txt (Miro board, workstream «ИИ в заявке»)",
  },
  discovery: "Sales-менеджеры не успевают просматривать все входящие лиды вручную и приоритизируют их по ощущению, что приводит к потере «горячих» сделок среди менее очевидных заявок.",
  problem: {
    statement: "Без системной оценки платежеспособности и срока покупки часть перспективных лидов обрабатывается с задержкой или вовсе не доходит до менеджера вовремя.",
    evidenceIds: ["evidence_demo_lead_backlog"],
  },
  users: [{ id: "user_sales_manager_lead", name: "Sales Manager", segment: "B2B Sales" }],
  jtbd: [
    {
      statement: "Когда поступает новый лид, я хочу сразу понять, насколько он приоритетен, чтобы не терять горячие сделки в общей очереди.",
      context: "Момент поступления лида в CRM",
      desiredOutcome: "Приоритетные лиды обрабатываются в первую очередь",
    },
  ],
  features: [{ id: "feature_hotness_score", name: "Hotness Scoring", description: "Оценка платежеспособности, срока покупки и итогового hotness-score.", priority: "high" }],
  mvp: "Приём текстового описания лида, извлечение платежеспособности и срока покупки, расчёт hotness, human review для неуверенных случаев.",
  metrics: [
    { name: "Time to first contact for hot leads", target: "-40%" },
    { name: "Scoring agreement with manager", target: ">= 80%" },
  ],
  prd: "Lead Qualification MVP принимает текстовое описание лида и возвращает structured оценку (платежеспособность, срок покупки, hotness, обоснование с цитатами).",
  frameworkIds: ["framework_jtbd"],
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

const architectureLead: Architecture = {
  id: "architecture_demo_lead_qualification",
  projectId: "project_demo_lead_qualification",
  productId: "product_demo_lead_qualification",
  status: "ready",
  capabilities: [
    { id: "cap_lead_ingest", name: "Lead Ingestion", description: "Приём текстового описания лида.", required: true },
    { id: "cap_lead_score", name: "Hotness Scoring", description: "Оценка платежеспособности, срока покупки и hotness.", required: true },
  ],
  aiComponents: [{ id: "component_lead_llm", name: "Lead Qualifier LLM", type: "llm", description: "Формирует structured оценку лида." }],
  modelIds: ["model_reasoning"],
  dataFlow: [{ id: "flow_lead_input", source: "Input", target: "Lead Qualifier LLM", dataType: "lead_description" }],
  quality: [{ name: "Hotness grounded in quote", threshold: "100%" }],
  evaluation: [{ metric: "Scoring agreement", method: "Manual review", threshold: ">= 0.8" }],
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

const nodesLead: Node[] = [
  { id: "node_lead_input", type: "input", name: "Lead Description", description: "Текстовое описание входящего лида.", inputPorts: [], outputPorts: [{ id: "port_lead_input_out", name: "lead_description" }], tools: [], metadata: { stage: "ingest" }, position: { x: 0, y: 100 }, version: "1.0.0" },
  { id: "node_lead_llm", type: "llm", name: "Lead Qualifier", description: "Оценивает платежеспособность, срок покупки и hotness.", inputPorts: [{ id: "port_lead_llm_in", name: "lead_description" }], outputPorts: [{ id: "port_lead_llm_out", name: "qualification" }], modelId: "model_reasoning", promptId: "prompt_lead_qualification", temperature: 0.3, tools: [], metadata: { output: "structured" }, position: { x: 280, y: 100 }, version: "1.0.0" },
  { id: "node_lead_review", type: "human_review", name: "Human Review", description: "Проверка low-confidence оценки лида.", inputPorts: [{ id: "port_lead_review_in", name: "needs review" }], outputPorts: [{ id: "port_lead_review_out", name: "reviewed" }], tools: [], metadata: { sla: "30m" }, position: { x: 560, y: 220 }, version: "1.0.0" },
  { id: "node_lead_store", type: "store", name: "CRM Lead Record", description: "Сохраняет оценку лида в CRM.", inputPorts: [{ id: "port_lead_store_in", name: "approved" }], outputPorts: [{ id: "port_lead_store_out", name: "stored result" }], tools: [], metadata: { retention: "365d" }, position: { x: 560, y: 20 }, version: "1.0.0" },
  { id: "node_lead_output", type: "output", name: "Lead Qualification Output", description: "Финальная structured оценка лида.", inputPorts: [{ id: "port_lead_output_in", name: "stored result" }], outputPorts: [], tools: [], metadata: { format: "json" }, position: { x: 840, y: 100 }, version: "1.0.0" },
];

const edgesLead: Edge[] = [
  { id: "edge_lead_input_llm", sourceNodeId: "node_lead_input", targetNodeId: "node_lead_llm", sourcePortId: "port_lead_input_out", targetPortId: "port_lead_llm_in", version: "1.0.0" },
  { id: "edge_lead_llm_store", sourceNodeId: "node_lead_llm", targetNodeId: "node_lead_store", sourcePortId: "port_lead_llm_out", targetPortId: "port_lead_store_in", condition: { field: "confidence", operator: "gte", value: 0.72 }, version: "1.0.0" },
  { id: "edge_lead_llm_review", sourceNodeId: "node_lead_llm", targetNodeId: "node_lead_review", sourcePortId: "port_lead_llm_out", targetPortId: "port_lead_review_in", condition: { field: "confidence", operator: "lt", value: 0.72 }, version: "1.0.0" },
  { id: "edge_lead_review_store", sourceNodeId: "node_lead_review", targetNodeId: "node_lead_store", sourcePortId: "port_lead_review_out", targetPortId: "port_lead_store_in", version: "1.0.0" },
  { id: "edge_lead_store_output", sourceNodeId: "node_lead_store", targetNodeId: "node_lead_output", sourcePortId: "port_lead_store_out", targetPortId: "port_lead_output_in", version: "1.0.0" },
];

const pipelineLead: Pipeline = {
  id: "pipeline_demo_lead_qualification",
  projectId: "project_demo_lead_qualification",
  architectureId: "architecture_demo_lead_qualification",
  status: "ready",
  nodes: nodesLead,
  edges: edgesLead,
  layout: { viewport: { x: 0, y: 0, zoom: 0.85 } },
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

/**
 * Third demo pipeline -- Chat Classification. Not derived from
 * pdf-notes.txt (unlike the two above); a smaller, clearly illustrative
 * example of the same input -> llm -> branch -> output shape applied
 * to a different, common support-chat domain, so the pipeline library
 * shows the pattern generalizes rather than only ever showing the
 * call-analysis case.
 */
const productChat: Product = {
  id: "product_demo_chat_classification",
  projectId: "project_demo_chat_classification",
  status: "ready",
  idea: { statement: "Chat Classification автоматически определяет категорию и тональность входящих сообщений чата поддержки и помечает те, что требуют эскалации." },
  discovery: "Support-агенты вручную сортируют входящие сообщения по срочности, что задерживает реакцию на негативные и технические обращения.",
  problem: { statement: "Сообщения, требующие немедленной эскалации, не всегда выделяются вовремя среди общего потока чата.", evidenceIds: [] },
  users: [{ id: "user_support_agent", name: "Support Agent", segment: "Customer Support" }],
  jtbd: [
    {
      statement: "Когда приходит новое сообщение в чат, я хочу сразу видеть его категорию и требует ли оно эскалации, чтобы не пропустить срочный случай.",
      context: "Новое сообщение в очереди поддержки",
      desiredOutcome: "Срочные сообщения обрабатываются в первую очередь",
    },
  ],
  features: [{ id: "feature_chat_triage", name: "Chat Triage", description: "Классификация по категории, тональности и признаку эскалации.", priority: "medium" }],
  mvp: "Приём текста сообщения, классификация по категории/тональности, human review для случаев, требующих эскалации.",
  metrics: [{ name: "Escalation detection recall", target: ">= 90%" }],
  prd: "Chat Classification MVP принимает текст сообщения и возвращает категорию, тональность и признак необходимости эскалации.",
  frameworkIds: [],
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

const architectureChat: Architecture = {
  id: "architecture_demo_chat_classification",
  projectId: "project_demo_chat_classification",
  productId: "product_demo_chat_classification",
  status: "ready",
  capabilities: [{ id: "cap_chat_classify", name: "Message Classification", description: "Определяет категорию, тональность и эскалацию.", required: true }],
  aiComponents: [{ id: "component_chat_llm", name: "Chat Classifier LLM", type: "llm", description: "Классифицирует входящее сообщение." }],
  modelIds: ["model_fast"],
  dataFlow: [{ id: "flow_chat_input", source: "Input", target: "Chat Classifier LLM", dataType: "chat_message" }],
  quality: [{ name: "Escalation grounded in quote", threshold: "100%" }],
  evaluation: [{ metric: "Escalation recall", method: "Manual review", threshold: ">= 0.9" }],
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

const nodesChat: Node[] = [
  { id: "node_chat_input", type: "input", name: "Chat Message", description: "Текст входящего сообщения чата поддержки.", inputPorts: [], outputPorts: [{ id: "port_chat_input_out", name: "chat_message" }], tools: [], metadata: { stage: "ingest" }, position: { x: 0, y: 100 }, version: "1.0.0" },
  { id: "node_chat_llm", type: "llm", name: "Chat Classifier", description: "Определяет категорию, тональность и необходимость эскалации.", inputPorts: [{ id: "port_chat_llm_in", name: "chat_message" }], outputPorts: [{ id: "port_chat_llm_out", name: "classification" }], modelId: "model_fast", promptId: "prompt_chat_classification", temperature: 0.2, tools: [], metadata: { output: "structured" }, position: { x: 280, y: 100 }, version: "1.0.0" },
  { id: "node_chat_review", type: "human_review", name: "Escalation Review", description: "Проверка сообщений с низкой уверенностью классификации.", inputPorts: [{ id: "port_chat_review_in", name: "needs review" }], outputPorts: [{ id: "port_chat_review_out", name: "reviewed" }], tools: [], metadata: { sla: "10m" }, position: { x: 560, y: 220 }, version: "1.0.0" },
  { id: "node_chat_store", type: "store", name: "Classification Log", description: "Сохраняет классификацию сообщения.", inputPorts: [{ id: "port_chat_store_in", name: "approved" }], outputPorts: [{ id: "port_chat_store_out", name: "stored result" }], tools: [], metadata: { retention: "30d" }, position: { x: 560, y: 20 }, version: "1.0.0" },
  { id: "node_chat_output", type: "output", name: "Chat Classification Output", description: "Финальная классификация сообщения.", inputPorts: [{ id: "port_chat_output_in", name: "stored result" }], outputPorts: [], tools: [], metadata: { format: "json" }, position: { x: 840, y: 100 }, version: "1.0.0" },
];

const edgesChat: Edge[] = [
  { id: "edge_chat_input_llm", sourceNodeId: "node_chat_input", targetNodeId: "node_chat_llm", sourcePortId: "port_chat_input_out", targetPortId: "port_chat_llm_in", version: "1.0.0" },
  { id: "edge_chat_llm_store", sourceNodeId: "node_chat_llm", targetNodeId: "node_chat_store", sourcePortId: "port_chat_llm_out", targetPortId: "port_chat_store_in", condition: { field: "confidence", operator: "gte", value: 0.72 }, version: "1.0.0" },
  { id: "edge_chat_llm_review", sourceNodeId: "node_chat_llm", targetNodeId: "node_chat_review", sourcePortId: "port_chat_llm_out", targetPortId: "port_chat_review_in", condition: { field: "confidence", operator: "lt", value: 0.72 }, version: "1.0.0" },
  { id: "edge_chat_review_store", sourceNodeId: "node_chat_review", targetNodeId: "node_chat_store", sourcePortId: "port_chat_review_out", targetPortId: "port_chat_store_in", version: "1.0.0" },
  { id: "edge_chat_store_output", sourceNodeId: "node_chat_store", targetNodeId: "node_chat_output", sourcePortId: "port_chat_store_out", targetPortId: "port_chat_output_in", version: "1.0.0" },
];

const pipelineChat: Pipeline = {
  id: "pipeline_demo_chat_classification",
  projectId: "project_demo_chat_classification",
  architectureId: "architecture_demo_chat_classification",
  status: "ready",
  nodes: nodesChat,
  edges: edgesChat,
  layout: { viewport: { x: 0, y: 0, zoom: 0.85 } },
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

/**
 * Fourth demo project -- Pipeline Lab v3 (§M.11 "полноценная интеграция").
 * This is the domain-model (Project/Product/Architecture/Pipeline)
 * mirror of the standalone tool at public/pipeline-lab-v3.html, so that
 * tool participates in the same Projects -> Product -> Architecture ->
 * Pipeline -> Playground lifecycle every other demo project does,
 * rather than sitting off to the side as an unrelated nav item.
 *
 * The Pipeline graph below is a faithful structural mirror of the real
 * tool's 10 stages plus its own transcript input, with edges drawn from
 * each stage's ACTUAL data dependencies (read directly from the real
 * CODE_FUNCS.gate/crm/store bodies in pipeline-lab-v3.html, not
 * guessed) -- Pipeline Lab v3 itself runs its stages as a flat ordered
 * list against one shared `ctx` object, not a dependency graph, so this
 * is the closest a Node/Edge DAG can get to the same real behavior.
 * Running THIS graph through the app's own Mock Runtime (Playground)
 * is a structural/mock exercise of the same shape -- for the real
 * OpenAI/Anthropic-backed run, use the "Открыть в Pipeline Lab v3"
 * link this project's Pipeline/Playground screens show (see
 * pipeline-screen.tsx / playground-screen.tsx).
 */
const productPipelineLab: Product = {
  id: "product_demo_pipeline_lab_v3",
  projectId: "project_demo_pipeline_lab_v3",
  status: "ready",
  idea: {
    statement: "Pipeline Lab v3 извлекает структурированную карточку CRM (факты, потребности, результат звонка, саммари) из звонков по недвижимости и решает, можно ли сохранить её автоматически, не теряя доверие к данным.",
    source: "pdf-notes.txt (Miro board, workstream «ИИ в заявке») + public/pipeline-lab-v3.html",
  },
  discovery:
    "Агенты по недвижимости теряют контекст звонка, если не заполняют карточку CRM сразу; ручное заполнение задерживает follow-up и даёт неполные/непроверенные данные о бюджете, сроке покупки и договорённостях.",
  problem: {
    statement: "Без проверенного автоматического извлечения фактов из звонка карточка CRM либо не заполняется вовремя, либо заполняется с ошибками и без цитат-обоснований.",
    evidenceIds: ["evidence_demo_realestate_calls"],
  },
  users: [
    { id: "user_realestate_agent", name: "Real Estate Agent", segment: "Недвижимость" },
    { id: "user_sales_manager_pl", name: "Sales Manager", segment: "Недвижимость" },
  ],
  jtbd: [
    {
      statement: "Когда завершился звонок с клиентом по недвижимости, я хочу получить проверенную карточку CRM с бюджетом, потребностями и next step, без ручного заполнения и без риска утечки чувствительных данных.",
      context: "Сразу после звонка с клиентом",
      desiredOutcome: "Карточка CRM заполнена автоматически там, где хватает уверенности, иначе -- честно отправлена на ручную проверку",
    },
  ],
  features: [
    { id: "feature_pl_fact_extraction", name: "Fact/Need/Outcome Extraction", description: "Извлечение бюджета, источника средств, потребностей и результата звонка с цитатами.", priority: "high" },
    { id: "feature_pl_cross_vendor_check", name: "Cross-Vendor Quality Check", description: "Независимая проверка саммари другим вендором на галлюцинации и утечку PII.", priority: "high" },
    { id: "feature_pl_quality_gate", name: "Confidence-Based Quality Gate", description: "Решение AUTO_SAVE / AUTO_SAVE+лог / RETRY / FALLBACK на основе взвешенной уверенности системы.", priority: "medium" },
  ],
  mvp: "10-этапный пайплайн: STT-симуляция (Nexara) -> валидация кодом -> извлечение фактов (LLM) -> единое хранилище (код) -> потребности (LLM) -> результат звонка (LLM) -> саммари (LLM) -> cross-vendor проверка (LLM) -> Quality Gate (код, confidence) -> сохранение в CRM.",
  metrics: [
    { name: "Confidence перед авто-сохранением", target: ">= 0.80" },
    { name: "Hallucination rate (проверщик)", target: "<= 5%" },
    { name: "Доля карточек с цитатой на ключевое поле", target: "100%" },
  ],
  prd:
    "Pipeline Lab v3 принимает текст звонка и возвращает: факты (бюджет, источник средств, имя, район), потребности, результат звонка, саммари для CRM, независимую cross-vendor проверку саммари и итоговое решение Quality Gate (AUTO_SAVE/RETRY/FALLBACK) с разбивкой уверенности по 5 сигналам.",
  frameworkIds: ["framework_jtbd", "framework_prd"],
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

const architecturePipelineLab: Architecture = {
  id: "architecture_demo_pipeline_lab_v3",
  projectId: "project_demo_pipeline_lab_v3",
  productId: "product_demo_pipeline_lab_v3",
  status: "ready",
  capabilities: [
    { id: "cap_pl_stt", name: "STT Ingestion (Nexara)", description: "Приём улучшенной транскрипции звонка.", required: true },
    { id: "cap_pl_extract", name: "Fact/Need/Outcome Extraction", description: "Извлечение структурированных фактов, потребностей и результата звонка.", required: true },
    { id: "cap_pl_check", name: "Cross-Vendor Verification", description: "Независимая проверка саммари вторым вендором.", required: true },
    { id: "cap_pl_gate", name: "Confidence-Based Quality Gate", description: "Взвешенное решение об автосохранении в CRM.", required: true },
  ],
  aiComponents: [
    { id: "component_pl_nexara", name: "Nexara STT", type: "gateway", description: "Внешний сервис распознавания и улучшения речи (в Lab -- симуляция)." },
    { id: "component_pl_validate", name: "Transcript Validator", type: "rules_engine", description: "Детерминированная проверка длины, ролей и завершённости транскрипции." },
    { id: "component_pl_facts", name: "Fact Agent", type: "llm", description: "Извлекает факты с цитатами (GPT-5 mini)." },
    { id: "component_pl_needs", name: "Need Agent", type: "llm", description: "Извлекает потребности клиента (GPT-5 mini)." },
    { id: "component_pl_outcome", name: "Outcome Agent", type: "llm", description: "Определяет результат звонка (GPT-5 mini)." },
    { id: "component_pl_summary", name: "Summary Agent", type: "llm", description: "Формирует саммари для карточки CRM (GPT-5 mini)." },
    { id: "component_pl_check", name: "Check Agent", type: "llm", description: "Независимая cross-vendor проверка саммари (Claude Sonnet 4.6)." },
    { id: "component_pl_gate", name: "Quality Gate", type: "rules_engine", description: "Взвешенная уверенность системы (5 сигналов) -> решение AUTO_SAVE/RETRY/FALLBACK." },
    { id: "component_pl_crm", name: "CRM Writer", type: "gateway", description: "Запись карточки в CRM (в Lab -- симуляция)." },
  ],
  modelIds: ["model_gpt5_mini", "model_claude_sonnet"],
  dataFlow: [
    { id: "flow_pl_input_facts", source: "Input", target: "Fact Agent", dataType: "transcript" },
    { id: "flow_pl_facts_store", source: "Fact Agent", target: "Единое хранилище", dataType: "facts" },
    { id: "flow_pl_summary_check", source: "Summary Agent", target: "Check Agent", dataType: "summary" },
    { id: "flow_pl_gate_crm", source: "Quality Gate", target: "CRM Writer", dataType: "decision" },
  ],
  quality: [
    { name: "Цитата на бюджет обязательна", threshold: "100%" },
    { name: "Порог автосохранения", threshold: "confidence >= 0.80" },
  ],
  evaluation: [
    { metric: "Hallucinations (проверщик)", method: "Cross-vendor LLM-judge", threshold: "0" },
    { metric: "PII leak (КЦ-саммари)", method: "Cross-vendor LLM-judge", threshold: "0" },
  ],
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

const nodesPipelineLab: Node[] = [
  { id: "node_pl_input", type: "input", name: "Транскрипция", description: "Текст звонка (роли: Агент / Оператор / Клиент).", inputPorts: [], outputPorts: [{ id: "port_pl_input_out", name: "transcript" }], tools: [], metadata: { stage: "ingest" }, position: { x: 0, y: 220 }, version: "1.0.0" },
  { id: "node_pl_nexara", type: "tool", name: "STT + улучшение (Nexara)", description: "В Lab транскрипция уже улучшена -- сервис Nexara симулируется.", inputPorts: [{ id: "port_pl_nexara_in", name: "transcript" }], outputPorts: [{ id: "port_pl_nexara_out", name: "stt" }], tools: ["nexara-stt"], metadata: { vendor: "Nexara" }, position: { x: 260, y: 40 }, version: "1.0.0" },
  { id: "node_pl_validate", type: "validation", name: "Валидация транскрипции", description: "Длина, роли, число реплик, завершённость -- детерминированно, без модели.", inputPorts: [{ id: "port_pl_validate_in", name: "transcript" }], outputPorts: [{ id: "port_pl_validate_out", name: "validation" }], tools: [], metadata: {}, position: { x: 260, y: 400 }, version: "1.0.0" },
  { id: "node_pl_facts", type: "llm", name: "Извлечение фактов", description: "Бюджет, источник средств, имя, район -- с цитатами.", inputPorts: [{ id: "port_pl_facts_in", name: "transcript" }], outputPorts: [{ id: "port_pl_facts_out", name: "facts" }], modelId: "model_gpt5_mini", promptId: "prompt_pipeline_lab_facts", temperature: 0.3, tools: [], metadata: { output: "structured" }, position: { x: 520, y: 220 }, version: "1.0.0" },
  { id: "node_pl_store", type: "store", name: "Единое хранилище", description: "Схема, справочники, нормализация бюджета, verify-before-store для цитат.", inputPorts: [{ id: "port_pl_store_in", name: "facts" }], outputPorts: [{ id: "port_pl_store_out", name: "store" }], tools: [], metadata: { retention: "365d" }, position: { x: 780, y: 220 }, version: "1.0.0" },
  { id: "node_pl_needs", type: "llm", name: "Определение потребностей", description: "Тип объекта, требования, срок покупки -- с цитатой.", inputPorts: [{ id: "port_pl_needs_in", name: "transcript" }], outputPorts: [{ id: "port_pl_needs_out", name: "needs" }], modelId: "model_gpt5_mini", promptId: "prompt_pipeline_lab_needs", temperature: 0.3, tools: [], metadata: { output: "structured" }, position: { x: 520, y: 400 }, version: "1.0.0" },
  { id: "node_pl_outcome", type: "llm", name: "Результат звонка", description: "Назначен показ / повторный звонок / отказ и т.д. + next step с цитатой.", inputPorts: [{ id: "port_pl_outcome_in", name: "transcript" }], outputPorts: [{ id: "port_pl_outcome_out", name: "outcome" }], modelId: "model_gpt5_mini", promptId: "prompt_pipeline_lab_outcome", temperature: 0.3, tools: [], metadata: { output: "structured" }, position: { x: 520, y: 580 }, version: "1.0.0" },
  { id: "node_pl_summary", type: "llm", name: "Генерация саммари", description: "Саммари для карточки CRM -- без телефонов, адресов и сумм в тексте.", inputPorts: [{ id: "port_pl_summary_in", name: "facts+needs+outcome" }], outputPorts: [{ id: "port_pl_summary_out", name: "summary" }], modelId: "model_gpt5_mini", promptId: "prompt_pipeline_lab_summary", temperature: 0.3, tools: [], metadata: { output: "structured" }, position: { x: 1040, y: 400 }, version: "1.0.0" },
  { id: "node_pl_check", type: "llm", name: "Проверка саммари (cross-vendor)", description: "Независимая проверка на галлюцинации и утечку PII -- другой вендор.", inputPorts: [{ id: "port_pl_check_in", name: "summary+store" }], outputPorts: [{ id: "port_pl_check_out", name: "summary_check" }], modelId: "model_claude_sonnet", promptId: "prompt_pipeline_lab_check", temperature: 0, tools: [], metadata: { output: "structured" }, position: { x: 1300, y: 400 }, version: "1.0.0" },
  { id: "node_pl_gate", type: "validation", name: "Quality Gate", description: "Взвешенная уверенность системы (цитаты 25% + валидация 15% + схема 15% + поля 15% + проверщик 30%) -> AUTO_SAVE/RETRY/FALLBACK.", inputPorts: [{ id: "port_pl_gate_in", name: "store+needs+outcome+check+validation" }], outputPorts: [{ id: "port_pl_gate_out", name: "gate" }], tools: [], metadata: { autoSaveThreshold: "0.80" }, position: { x: 1560, y: 220 }, version: "1.0.0" },
  { id: "node_pl_crm", type: "output", name: "Сохранение в CRM", description: "Карточка CRM: клиент, бюджет, потребности, результат, саммари, решение Gate.", inputPorts: [{ id: "port_pl_crm_in", name: "gate+store+needs+outcome+summary" }], outputPorts: [], tools: [], metadata: { format: "json" }, position: { x: 1820, y: 220 }, version: "1.0.0" },
];

const edgesPipelineLab: Edge[] = [
  { id: "edge_pl_input_nexara", sourceNodeId: "node_pl_input", targetNodeId: "node_pl_nexara", sourcePortId: "port_pl_input_out", targetPortId: "port_pl_nexara_in", version: "1.0.0" },
  { id: "edge_pl_input_validate", sourceNodeId: "node_pl_input", targetNodeId: "node_pl_validate", sourcePortId: "port_pl_input_out", targetPortId: "port_pl_validate_in", version: "1.0.0" },
  { id: "edge_pl_input_facts", sourceNodeId: "node_pl_input", targetNodeId: "node_pl_facts", sourcePortId: "port_pl_input_out", targetPortId: "port_pl_facts_in", version: "1.0.0" },
  { id: "edge_pl_input_needs", sourceNodeId: "node_pl_input", targetNodeId: "node_pl_needs", sourcePortId: "port_pl_input_out", targetPortId: "port_pl_needs_in", version: "1.0.0" },
  { id: "edge_pl_input_outcome", sourceNodeId: "node_pl_input", targetNodeId: "node_pl_outcome", sourcePortId: "port_pl_input_out", targetPortId: "port_pl_outcome_in", version: "1.0.0" },
  { id: "edge_pl_facts_store", sourceNodeId: "node_pl_facts", targetNodeId: "node_pl_store", sourcePortId: "port_pl_facts_out", targetPortId: "port_pl_store_in", version: "1.0.0" },
  { id: "edge_pl_facts_summary", sourceNodeId: "node_pl_facts", targetNodeId: "node_pl_summary", sourcePortId: "port_pl_facts_out", targetPortId: "port_pl_summary_in", version: "1.0.0" },
  { id: "edge_pl_needs_summary", sourceNodeId: "node_pl_needs", targetNodeId: "node_pl_summary", sourcePortId: "port_pl_needs_out", targetPortId: "port_pl_summary_in", version: "1.0.0" },
  { id: "edge_pl_outcome_summary", sourceNodeId: "node_pl_outcome", targetNodeId: "node_pl_summary", sourcePortId: "port_pl_outcome_out", targetPortId: "port_pl_summary_in", version: "1.0.0" },
  { id: "edge_pl_summary_check", sourceNodeId: "node_pl_summary", targetNodeId: "node_pl_check", sourcePortId: "port_pl_summary_out", targetPortId: "port_pl_check_in", version: "1.0.0" },
  { id: "edge_pl_store_check", sourceNodeId: "node_pl_store", targetNodeId: "node_pl_check", sourcePortId: "port_pl_store_out", targetPortId: "port_pl_check_in", version: "1.0.0" },
  { id: "edge_pl_store_gate", sourceNodeId: "node_pl_store", targetNodeId: "node_pl_gate", sourcePortId: "port_pl_store_out", targetPortId: "port_pl_gate_in", version: "1.0.0" },
  { id: "edge_pl_needs_gate", sourceNodeId: "node_pl_needs", targetNodeId: "node_pl_gate", sourcePortId: "port_pl_needs_out", targetPortId: "port_pl_gate_in", version: "1.0.0" },
  { id: "edge_pl_outcome_gate", sourceNodeId: "node_pl_outcome", targetNodeId: "node_pl_gate", sourcePortId: "port_pl_outcome_out", targetPortId: "port_pl_gate_in", version: "1.0.0" },
  { id: "edge_pl_check_gate", sourceNodeId: "node_pl_check", targetNodeId: "node_pl_gate", sourcePortId: "port_pl_check_out", targetPortId: "port_pl_gate_in", version: "1.0.0" },
  { id: "edge_pl_validate_gate", sourceNodeId: "node_pl_validate", targetNodeId: "node_pl_gate", sourcePortId: "port_pl_validate_out", targetPortId: "port_pl_gate_in", version: "1.0.0" },
  { id: "edge_pl_gate_crm", sourceNodeId: "node_pl_gate", targetNodeId: "node_pl_crm", sourcePortId: "port_pl_gate_out", targetPortId: "port_pl_crm_in", version: "1.0.0" },
  { id: "edge_pl_store_crm", sourceNodeId: "node_pl_store", targetNodeId: "node_pl_crm", sourcePortId: "port_pl_store_out", targetPortId: "port_pl_crm_in", version: "1.0.0" },
  { id: "edge_pl_needs_crm", sourceNodeId: "node_pl_needs", targetNodeId: "node_pl_crm", sourcePortId: "port_pl_needs_out", targetPortId: "port_pl_crm_in", version: "1.0.0" },
  { id: "edge_pl_outcome_crm", sourceNodeId: "node_pl_outcome", targetNodeId: "node_pl_crm", sourcePortId: "port_pl_outcome_out", targetPortId: "port_pl_crm_in", version: "1.0.0" },
  { id: "edge_pl_summary_crm", sourceNodeId: "node_pl_summary", targetNodeId: "node_pl_crm", sourcePortId: "port_pl_summary_out", targetPortId: "port_pl_crm_in", version: "1.0.0" },
];

const pipelinePipelineLab: Pipeline = {
  id: "pipeline_demo_pipeline_lab_v3",
  projectId: "project_demo_pipeline_lab_v3",
  architectureId: "architecture_demo_pipeline_lab_v3",
  status: "ready",
  nodes: nodesPipelineLab,
  edges: edgesPipelineLab,
  layout: { viewport: { x: 0, y: 0, zoom: 0.6 } },
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

/**
 * Fifth demo product -- "Генерация текстов объявлений" (Ad Copy
 * Generation for real-estate listings). Added 2026-07-05 to
 * demonstrate a full Product -> Architecture -> Pipeline -> Playground
 * -> Dashboard cycle end to end for a genuinely new AI feature, not
 * just the call-analysis reference case (CLAUDE.md §3.4 still prefers
 * the call-analysis case as the *primary* reference; this is an
 * additional, independent demo, not a replacement for it).
 *
 * Node types follow the exact same mapping precedent already
 * established by `productLead`/`productChat` above: a single-call LLM
 * step is `type: "llm"` (not `"agent"` -- CLAUDE.md §20.2 "Workflow
 * before Agent", no genuinely dynamic planning happens here), and no
 * node uses `type: "validation"` for the same reason `productLead`
 * doesn't: `real-stage.ts`'s deterministic validation handler only
 * recognizes `CallAnalysisSummarySchema`, so a `validation` node here
 * would always show `validated: false` -- misleading rather than
 * informative. The "Контур качества" stage is `type: "function"`
 * instead (matches its own task-specified "Тип: Code" label exactly),
 * and branches purely on the `confidence` field every `llm` stage
 * already carries (`real-stage.ts`'s `confidenceFromTemperature`).
 *
 * "Quality Gate" retry policy (confidence >= 0.90 -> save, else retry
 * up to 2 times) is documented on `node_ad_gate.metadata`, not executed
 * as a graph cycle: `topology.ts`'s `topologicalOrder` explicitly
 * throws `CyclicPipelineError` for a cyclic graph, and the task's own
 * "Количество этапов — 9" requirement rules out adding a 10th
 * human-review-style fallback node the way `pipeline` (call-analysis)
 * does. This is stated plainly rather than silently pretending a loop
 * is being executed.
 */
const productAdCopy: Product = {
  id: "product_ad_copy_generation",
  projectId: "project_ad_copy_generation",
  status: "ready",
  idea: {
    statement: "AI автоматически создаёт продающее объявление объекта недвижимости на основе структурированных данных CRM — без ручного написания текста агентом.",
    source: "Product Discovery",
  },
  discovery:
    "Агенты недвижимости вручную пишут объявления по каждому объекту. Наблюдения: объявления сильно отличаются по качеству между агентами, отсутствует единый стиль компании, тексты часто неполные и не отражают все преимущества объекта, встречаются ошибки русского языка, подготовка занимает много времени и требует большого объёма ручной работы контент-менеджеров.",
  problem: {
    statement:
      "Агенты недвижимости вручную пишут объявления: качество текстов сильно различается, нет единого стиля компании, объявления часто неполные и теряют преимущества объекта, встречаются ошибки языка, скорость подготовки низкая, а объём ручной работы велик.",
    evidenceIds: [],
  },
  users: [
    { id: "user_ad_realtor", name: "Агент недвижимости", segment: "Продажи" },
    { id: "user_ad_sales_lead", name: "Руководитель отдела продаж", segment: "Управление продажами" },
    { id: "user_ad_content_manager", name: "Контент-менеджер", segment: "Контент и публикации" },
    { id: "user_ad_marketer", name: "Маркетолог", segment: "Маркетинг" },
  ],
  jtbd: [
    {
      statement: "Когда у меня появился новый объект в CRM, я хочу автоматически получить готовое продающее объявление, чтобы не тратить время на ручное написание текста.",
      context: "После добавления объекта в CRM",
      desiredOutcome: "Объявление готово к публикации за секунды, без потери преимуществ объекта",
    },
    {
      statement: "Когда я руковожу отделом продаж, я хочу, чтобы все объявления соответствовали единому стилю компании, чтобы бренд выглядел профессионально на всех площадках.",
      context: "Контроль качества публикаций",
      desiredOutcome: "Единый узнаваемый стиль объявлений во всей компании",
    },
  ],
  features: [
    { id: "feature_ad_validation", name: "Валидация CRM-данных", description: "Проверка обязательных полей, типов и диапазонов перед генерацией.", priority: "high" },
    { id: "feature_ad_benefits", name: "Извлечение преимуществ", description: "Автоматическое определение УТП, сильных сторон и целевой аудитории объекта.", priority: "high" },
    { id: "feature_ad_generation", name: "Генерация объявления", description: "Формирование заголовка, описания и CTA на основе данных и преимуществ.", priority: "high" },
    { id: "feature_ad_selfcheck", name: "Самопроверка качества", description: "LLM Checker проверяет факты, стиль, язык, SEO и запреты перед сохранением.", priority: "high" },
    { id: "feature_ad_quality_gate", name: "Quality Gate", description: "Confidence-based решение: сохранить результат или запросить повторную генерацию (до 2 попыток).", priority: "medium" },
  ],
  mvp:
    "Приём CRM JSON одного объекта, валидация и нормализация данных, извлечение преимуществ, генерация Title/Description/CTA, самопроверка качества, confidence-based Quality Gate, сохранение результата с метаданными (модель, версия промпта, дата).",
  mvpOut:
    "Массовая пакетная генерация по всей базе объектов, поддержка нескольких языков, A/B-тестирование вариантов объявлений, автоматическая публикация на внешние площадки (Avito, Циан) без участия контент-менеджера, генерация изображений/визуального контента.",
  metrics: [
    { name: "Среднее время генерации", target: "< 8 сек на объявление", category: "speed" },
    { name: "Стоимость генерации", target: "< $0.05 за объявление", category: "cost" },
    { name: "Средний Confidence", target: ">= 0.90", category: "quality" },
    { name: "Количество Retry", target: "<= 2 на объявление", category: "quality" },
    { name: "Доля успешных генераций", target: ">= 95%", category: "success" },
    { name: "Средняя длина объявления", target: "400-700 символов", category: "quality" },
    { name: "Процент прохождения Quality Gate", target: ">= 90% с первой попытки", category: "success" },
    { name: "Стоимость: Code (детерминированные этапы)", target: "$0 (без вызовов модели)", category: "cost" },
    { name: "Стоимость: LLM (3 вызова GPT-5 mini)", target: "≈ $0.02–0.04 за объявление", category: "cost" },
    { name: "Стоимость: Storage", target: "$0 (in-memory контекст, без внешнего хранилища)", category: "cost" },
    { name: "Стоимость: Service (сохранение в CRM)", target: "$0 (внутренний вызов)", category: "cost" },
    { name: "Итоговая стоимость на объявление", target: "≈ $0.02–0.05", category: "cost" },
  ],
  prd:
    "Продукт принимает структурированный CRM JSON одного объекта недвижимости и возвращает готовое продающее объявление (заголовок, описание, CTA) с оценкой уверенности (Confidence Score). Пайплайн включает валидацию входных данных, нормализацию, извлечение преимуществ через LLM, единое хранилище контекста, генерацию текста, самопроверку качества и confidence-based Quality Gate перед сохранением результата в CRM.",
  frameworkIds: ["framework_jtbd", "framework_prd"],
  valueProposition:
    "Сократить время создания объявления с часов до секунд, повысить и стандартизировать качество текста по единому стилю компании и увеличить конверсию просмотров за счёт более продающих и полных описаний.",
  targetAudience: "Агентства недвижимости и отделы продаж, ведущие объекты в CRM и публикующие объявления на нескольких площадках.",
  userStory:
    "Как агент недвижимости, я хочу, чтобы после заполнения карточки объекта в CRM AI автоматически подготовил продающее объявление, чтобы я мог сразу опубликовать его без ручного написания текста.",
  mainScenario:
    "Агент заполняет карточку объекта в CRM (тип сделки, адрес, площадь, цена, особенности и т.д.) и запускает генерацию. Pipeline проверяет и нормализует данные, извлекает преимущества объекта, формирует заголовок/описание/CTA, проверяет качество текста и, если уверенность модели достаточна, сохраняет объявление вместе с метаданными (модель, версия промпта, дата генерации) обратно в CRM для публикации.",
  assumptions:
    "CRM предоставляет структурированные данные объекта в формате JSON. Компания имеет единые правила стиля и запрещённые формулировки, которые можно закодировать в промптах. GPT-5 mini достаточно для извлечения преимуществ, генерации и самопроверки без потери качества.",
  aiModels: "GPT-5 mini используется на трёх LLM-этапах: извлечение преимуществ, генерация объявления и самопроверка (LLM Checker).",
  aiAgents: "Агент извлечения преимуществ (Benefit Extraction Agent), агент генерации объявления (Ad Generation Agent), агент самопроверки (Self-Check Agent / LLM Checker).",
  aiPipelineNotes:
    "9-этапный pipeline: (1) валидация входных данных, (2) подготовка структуры объекта, (3) агент извлечения преимуществ (LLM), (4) единое хранилище, (5) генерация объявления (LLM), (6) проверка объявления (LLM Checker), (7) контур качества (код), (8) Quality Gate (confidence >= 90, до 2 retry), (9) сохранение.",
  acceptanceCriteria:
    "Объявление содержит заголовок, описание и CTA, основанные только на реальных данных объекта. Confidence Score рассчитан и отображается. При confidence >= 90% результат сохраняется автоматически; при более низком — предусмотрена повторная попытка (до 2 раз). Объявление не содержит запрещённых слов, ошибок русского языка и повторов. Все этапы пайплайна видны и кликабельны в Playground.",
  roadmap:
    "Этап 1 (MVP): одиночная генерация по одному объекту с ручным запуском в Playground. Этап 2: пакетная генерация по всей базе объектов CRM. Этап 3: A/B-тестирование вариантов объявлений и автоматический выбор лучшего по конверсии. Этап 4: прямая публикация на внешние площадки (Avito, Циан, Домклик).",
  notes:
    "Категория: AI Product · Статус: MVP. Демонстрационный продукт AI Product Studio, показывающий полный цикл разработки AI-функции: Product -> Architecture -> Pipeline -> Playground -> Dashboard.",
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

const architectureAdCopy: Architecture = {
  id: "architecture_ad_copy_generation",
  projectId: "project_ad_copy_generation",
  productId: "product_ad_copy_generation",
  status: "ready",
  capabilities: [
    { id: "cap_ad_ingest", name: "CRM Data Ingestion", description: "Приём структурированных данных объекта из CRM (JSON).", required: true },
    { id: "cap_ad_validate", name: "Input Validation", description: "Проверка обязательных полей, типов и диапазонов входных данных.", required: true },
    { id: "cap_ad_benefits", name: "Benefit Extraction", description: "Определение преимуществ, УТП и целевой аудитории объекта.", required: true },
    { id: "cap_ad_generation", name: "Ad Copy Generation", description: "Генерация заголовка, описания и CTA объявления.", required: true },
    { id: "cap_ad_quality", name: "Quality Gate", description: "Самопроверка и confidence-based решение о сохранении или retry.", required: true },
  ],
  aiComponents: [
    { id: "component_ad_benefits_llm", name: "Benefit Extraction Agent", type: "llm", description: "GPT-5 mini формирует преимущества, УТП и целевую аудиторию объекта." },
    { id: "component_ad_generation_llm", name: "Ad Generation Agent", type: "llm", description: "GPT-5 mini генерирует Title/Description/CTA объявления." },
    { id: "component_ad_checker_llm", name: "Self-Check Agent", type: "llm", description: "GPT-5 mini проверяет факты, стиль, язык и SEO готового объявления." },
    { id: "component_ad_quality_gate", name: "Quality Gate", type: "rules_engine", description: "Детерминированная логика: confidence >= 90 -> сохранить, иначе retry (до 2 попыток)." },
  ],
  modelIds: ["model_gpt5_mini"],
  dataFlow: [
    { id: "flow_ad_1", source: "CRM", target: "Validation", dataType: "crm_json" },
    { id: "flow_ad_2", source: "Validation", target: "Normalization", dataType: "validated_json" },
    { id: "flow_ad_3", source: "Normalization", target: "LLM Analysis", dataType: "normalized_json" },
    { id: "flow_ad_4", source: "LLM Analysis", target: "Storage", dataType: "benefits_json" },
    { id: "flow_ad_5", source: "Storage", target: "Generation", dataType: "stored_context" },
    { id: "flow_ad_6", source: "Generation", target: "Checker", dataType: "ad_draft_json" },
    { id: "flow_ad_7", source: "Checker", target: "Quality", dataType: "checked_ad_json" },
    { id: "flow_ad_8", source: "Quality", target: "CRM", dataType: "final_ad_json" },
  ],
  quality: [
    { name: "Confidence threshold", threshold: ">= 0.90" },
    { name: "Retry limit", threshold: "<= 2" },
    { name: "Required fields completeness", threshold: "100%" },
  ],
  evaluation: [
    { metric: "Ad quality score", method: "LLM self-check + human sampling", threshold: ">= 90" },
    { metric: "Generation latency", method: "Pipeline Run metrics", threshold: "< 8000ms" },
    { metric: "Cost per ad", method: "Token estimate", threshold: "< $0.05" },
  ],
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

const CRM_INPUT_JSON_SCHEMA_TEXT = `{
  "property": {
    "deal_type": "string",
    "property_type": "string",
    "address": "string?",
    "market_type": "string?",
    "rooms": "number?",
    "floor": "number?",
    "floors_total": "number?",
    "total_area": "number?",
    "living_area": "number?",
    "kitchen_area": "number?",
    "ceiling_height": "number?",
    "renovation": "string?",
    "bathrooms": "number?",
    "loggias": "number?",
    "rooms_isolated": "boolean?",
    "windows": "string[]?",
    "building_material": "string?",
    "heating": "string?",
    "year_built": "number?",
    "price": "number?"
  },
  "user_settings": {
    "style": "string?",
    "focus": "string[]?",
    "text_length": "{min_characters?, max_characters?}?",
    "target_audience": "string[]?",
    "structure": "string?",
    "emoji": "boolean?"
  }
}`;

const BENEFITS_JSON_SCHEMA_TEXT = `{
  "advantages": "string[]",
  "usp": "string",
  "strengths": "string[]",
  "selling_points": "string[]",
  "target_audience": "string[]"
}`;

const AD_OUTPUT_JSON_SCHEMA_TEXT = `{
  "title": "string",
  "description": "string",
  "cta": "string",
  "confidence": "number (0-1, добавляется автоматически)"
}`;

const QUALITY_CHECK_JSON_SCHEMA_TEXT = `{
  "facts_ok": "boolean",
  "style_ok": "boolean",
  "language_ok": "boolean",
  "prohibited_words_ok": "boolean",
  "readability_score": "number (0-100)",
  "seo_ok": "boolean",
  "duplicates_ok": "boolean",
  "title": "string",
  "description": "string",
  "cta": "string",
  "issues": "string[]",
  "confidence": "number (0-1, добавляется автоматически)"
}`;

const nodesAdCopy: Node[] = [
  {
    id: "node_ad_validate",
    type: "function",
    name: "Валидация входных данных",
    description: "Проверка обязательных полей CRM JSON, типов, диапазонов и пустых значений перед дальнейшей обработкой.",
    inputPorts: [],
    outputPorts: [{ id: "port_ad_validate_out", name: "validated_json" }],
    tools: [],
    metadata: { stage: "ingest", checks: "required_fields,types,ranges,empty_values", jsonSchema: CRM_INPUT_JSON_SCHEMA_TEXT },
    position: { x: 0, y: 160 },
    version: "1.0.0",
  },
  {
    id: "node_ad_normalize",
    type: "function",
    name: "Подготовка структуры объекта",
    description: "Нормализация CRM-данных: очистка текста, удаление HTML, объединение полей, стандартизация структуры объекта недвижимости.",
    inputPorts: [{ id: "port_ad_normalize_in", name: "validated_json" }],
    outputPorts: [{ id: "port_ad_normalize_out", name: "normalized_json" }],
    tools: [],
    metadata: { checks: "html_strip,text_clean,field_merge,structure_standardization" },
    position: { x: 260, y: 160 },
    version: "1.0.0",
  },
  {
    id: "node_ad_benefits",
    type: "llm",
    name: "Агент извлечения преимуществ",
    description: "Определяет преимущества объекта, УТП, сильные стороны, целевую аудиторию, продающие тезисы и стиль объявления.",
    inputPorts: [{ id: "port_ad_benefits_in", name: "normalized_json" }],
    outputPorts: [{ id: "port_ad_benefits_out", name: "benefits_json" }],
    modelId: "model_gpt5_mini",
    promptId: "prompt_ad_benefits",
    temperature: 0.4,
    tools: [],
    metadata: { output: "structured", jsonSchema: BENEFITS_JSON_SCHEMA_TEXT },
    position: { x: 520, y: 60 },
    version: "1.0.0",
  },
  {
    id: "node_ad_storage",
    type: "store",
    name: "Единое хранилище",
    description: "Сохраняет структурированные данные (нормализованный объект + преимущества) для использования всеми последующими агентами.",
    inputPorts: [{ id: "port_ad_storage_in", name: "context" }],
    outputPorts: [{ id: "port_ad_storage_out", name: "stored_context" }],
    tools: [],
    metadata: { retention: "session" },
    position: { x: 780, y: 160 },
    version: "1.0.0",
  },
  {
    id: "node_ad_generate",
    type: "llm",
    name: "Генерация объявления",
    description: "Создаёт Title, Description и CTA на основе CRM, справочников, структуры объекта, преимуществ и правил компании.",
    inputPorts: [{ id: "port_ad_generate_in", name: "stored_context" }],
    outputPorts: [{ id: "port_ad_generate_out", name: "ad_draft_json" }],
    modelId: "model_gpt5_mini",
    promptId: "prompt_ad_generation",
    temperature: 0.5,
    tools: [],
    metadata: { output: "structured", jsonSchema: AD_OUTPUT_JSON_SCHEMA_TEXT },
    position: { x: 1040, y: 160 },
    version: "1.0.0",
  },
  {
    id: "node_ad_checker",
    type: "llm",
    name: "Проверка объявления",
    description: "Самопроверка объявления: факты, стиль, русский язык, запреты, читаемость, SEO, повторы. Исправляет найденные ошибки.",
    inputPorts: [{ id: "port_ad_checker_in", name: "ad_draft_json" }],
    outputPorts: [{ id: "port_ad_checker_out", name: "checked_ad_json" }],
    modelId: "model_gpt5_mini",
    promptId: "prompt_ad_checker",
    temperature: 0.2,
    tools: [],
    metadata: { output: "structured", jsonSchema: QUALITY_CHECK_JSON_SCHEMA_TEXT },
    position: { x: 1300, y: 160 },
    version: "1.0.0",
  },
  {
    id: "node_ad_quality",
    type: "function",
    name: "Контур качества",
    description: "Проверка структуры, обязательных полей, требований площадок (длина, запрещённые символы) и расчёт итогового Confidence Score. Каждая проверка отображается отдельно (см. поля checked_ad_json).",
    inputPorts: [{ id: "port_ad_quality_in", name: "checked_ad_json" }],
    outputPorts: [{ id: "port_ad_quality_out", name: "quality_report_json" }],
    tools: [],
    metadata: { checks: "structure,required_fields,platform_requirements,confidence_score" },
    position: { x: 1560, y: 160 },
    version: "1.0.0",
  },
  {
    id: "node_ad_gate",
    type: "router",
    name: "Quality Gate",
    description:
      "Если confidence >= 90 — сохранить результат. Иначе — до 2 повторных попыток генерации (retry), затем сохранение с пометкой low-confidence. Граф этого MVP реализован как DAG (без циклов), поэтому retry-политика задокументирована в metadata, а не выполняется как цикл исполнения.",
    inputPorts: [{ id: "port_ad_gate_in", name: "quality_report_json" }],
    outputPorts: [{ id: "port_ad_gate_out", name: "gated_json" }],
    tools: [],
    metadata: { threshold: "0.90", maxRetries: "2", retryTarget: "node_ad_generate" },
    position: { x: 1820, y: 160 },
    version: "1.0.0",
  },
  {
    id: "node_ad_save",
    type: "output",
    name: "Сохранение",
    description: "Сохраняет объявление, CTA, Confidence, использованную модель, версию промпта и дату генерации.",
    inputPorts: [{ id: "port_ad_save_in", name: "gated_json" }],
    outputPorts: [],
    tools: [],
    metadata: { format: "json", fields: "ad,cta,confidence,model,promptVersion,generatedAt" },
    position: { x: 2080, y: 160 },
    version: "1.0.0",
  },
];

const edgesAdCopy: Edge[] = [
  { id: "edge_ad_validate_normalize", sourceNodeId: "node_ad_validate", targetNodeId: "node_ad_normalize", sourcePortId: "port_ad_validate_out", targetPortId: "port_ad_normalize_in", version: "1.0.0" },
  { id: "edge_ad_normalize_benefits", sourceNodeId: "node_ad_normalize", targetNodeId: "node_ad_benefits", sourcePortId: "port_ad_normalize_out", targetPortId: "port_ad_benefits_in", version: "1.0.0" },
  { id: "edge_ad_normalize_storage", sourceNodeId: "node_ad_normalize", targetNodeId: "node_ad_storage", sourcePortId: "port_ad_normalize_out", targetPortId: "port_ad_storage_in", version: "1.0.0" },
  { id: "edge_ad_benefits_storage", sourceNodeId: "node_ad_benefits", targetNodeId: "node_ad_storage", sourcePortId: "port_ad_benefits_out", targetPortId: "port_ad_storage_in", version: "1.0.0" },
  { id: "edge_ad_storage_generate", sourceNodeId: "node_ad_storage", targetNodeId: "node_ad_generate", sourcePortId: "port_ad_storage_out", targetPortId: "port_ad_generate_in", version: "1.0.0" },
  { id: "edge_ad_storage_checker", sourceNodeId: "node_ad_storage", targetNodeId: "node_ad_checker", sourcePortId: "port_ad_storage_out", targetPortId: "port_ad_checker_in", version: "1.0.0" },
  { id: "edge_ad_generate_checker", sourceNodeId: "node_ad_generate", targetNodeId: "node_ad_checker", sourcePortId: "port_ad_generate_out", targetPortId: "port_ad_checker_in", version: "1.0.0" },
  { id: "edge_ad_checker_quality", sourceNodeId: "node_ad_checker", targetNodeId: "node_ad_quality", sourcePortId: "port_ad_checker_out", targetPortId: "port_ad_quality_in", version: "1.0.0" },
  { id: "edge_ad_quality_gate", sourceNodeId: "node_ad_quality", targetNodeId: "node_ad_gate", sourcePortId: "port_ad_quality_out", targetPortId: "port_ad_gate_in", version: "1.0.0" },
  { id: "edge_ad_gate_save", sourceNodeId: "node_ad_gate", targetNodeId: "node_ad_save", sourcePortId: "port_ad_gate_out", targetPortId: "port_ad_save_in", version: "1.0.0" },
];

const pipelineAdCopy: Pipeline = {
  id: "pipeline_ad_copy_generation",
  projectId: "project_ad_copy_generation",
  architectureId: "architecture_ad_copy_generation",
  status: "ready",
  nodes: nodesAdCopy,
  edges: edgesAdCopy,
  layout: { viewport: { x: 0, y: 0, zoom: 0.5 } },
  createdAt,
  updatedAt: createdAt,
  version: "1.0.0",
};

const reviews: Review[] = [
  { id: "review_product_demo", targetType: "product", targetId: "product_demo_call_analysis", status: "approved", score: 91, issues: [], reviewerModuleId: "knowledge_spm", createdAt, version: "1.0.0" },
  { id: "review_architecture_demo", targetType: "architecture", targetId: "architecture_demo_call_analysis", status: "approved", score: 93, issues: [], reviewerModuleId: "knowledge_architect", createdAt, version: "1.0.0" },
  { id: "review_pipeline_demo", targetType: "pipeline", targetId: "pipeline_demo_call_analysis", status: "approved", score: 89, issues: [], createdAt, version: "1.0.0" },
  { id: "review_product_lead", targetType: "product", targetId: "product_demo_lead_qualification", status: "approved", score: 88, issues: [], reviewerModuleId: "knowledge_spm", createdAt, version: "1.0.0" },
  { id: "review_architecture_lead", targetType: "architecture", targetId: "architecture_demo_lead_qualification", status: "approved", score: 90, issues: [], reviewerModuleId: "knowledge_architect", createdAt, version: "1.0.0" },
  { id: "review_pipeline_lead", targetType: "pipeline", targetId: "pipeline_demo_lead_qualification", status: "approved", score: 87, issues: [], createdAt, version: "1.0.0" },
  { id: "review_product_chat", targetType: "product", targetId: "product_demo_chat_classification", status: "approved", score: 85, issues: [], reviewerModuleId: "knowledge_spm", createdAt, version: "1.0.0" },
  { id: "review_architecture_chat", targetType: "architecture", targetId: "architecture_demo_chat_classification", status: "approved", score: 86, issues: [], reviewerModuleId: "knowledge_architect", createdAt, version: "1.0.0" },
  { id: "review_pipeline_chat", targetType: "pipeline", targetId: "pipeline_demo_chat_classification", status: "approved", score: 84, issues: [], createdAt, version: "1.0.0" },
  { id: "review_product_pl", targetType: "product", targetId: "product_demo_pipeline_lab_v3", status: "approved", score: 92, issues: [], reviewerModuleId: "knowledge_spm", createdAt, version: "1.0.0" },
  { id: "review_architecture_pl", targetType: "architecture", targetId: "architecture_demo_pipeline_lab_v3", status: "approved", score: 94, issues: [], reviewerModuleId: "knowledge_architect", createdAt, version: "1.0.0" },
  { id: "review_pipeline_pl", targetType: "pipeline", targetId: "pipeline_demo_pipeline_lab_v3", status: "approved", score: 90, issues: [], createdAt, version: "1.0.0" },
  { id: "review_product_ad", targetType: "product", targetId: "product_ad_copy_generation", status: "approved", score: 90, issues: [], reviewerModuleId: "knowledge_spm", createdAt, version: "1.0.0" },
  { id: "review_architecture_ad", targetType: "architecture", targetId: "architecture_ad_copy_generation", status: "approved", score: 91, issues: [], reviewerModuleId: "knowledge_architect", createdAt, version: "1.0.0" },
  { id: "review_pipeline_ad", targetType: "pipeline", targetId: "pipeline_ad_copy_generation", status: "approved", score: 89, issues: [], createdAt, version: "1.0.0" },
];

const runs: Run[] = [
  {
    id: "run_demo_seed",
    pipelineId: "pipeline_demo_call_analysis",
    status: "succeeded",
    input: "Клиент спрашивает про интеграцию с CRM, сроки внедрения и риски точности summary.",
    output: {
      summary: "Клиент заинтересован в CRM-интеграции и хочет понять качество автоматического summary.",
      needs: ["CRM integration", "accuracy control", "fast rollout"],
      risks: ["недоверие к автоматическому summary"],
      nextAction: "Показать demo и обсудить evaluation thresholds.",
    },
    metrics: [
      { name: "tokens", value: 1840, unit: "tokens" },
      { name: "cost", value: 0.032, unit: "usd" },
      { name: "latency", value: 1260, unit: "ms" },
    ],
    evidence: [],
    latencyMs: 1260,
    costUsd: 0.032,
    logs: [
      { timestamp: createdAt, level: "info", message: "Pipeline run started." },
      { timestamp: createdAt, level: "info", message: "Need Extractor completed structured output." },
      { timestamp: createdAt, level: "info", message: "Quality Validator approved result." },
    ],
    startedAt: createdAt,
    finishedAt: createdAt,
    version: "1.0.0",
  },
  {
    id: "run_demo_lead_seed",
    pipelineId: "pipeline_demo_lead_qualification",
    status: "succeeded",
    input: "Клиент готов внести предоплату на этой неделе, интересуется тарифом Pro для команды из 20 человек.",
    output: {
      платежеспособность: "high",
      срок_покупки: "эта неделя",
      hotness: 0.88,
      обоснование: "Клиент явно называет срок и готов к предоплате, что указывает на высокую готовность к покупке.",
      цитаты: ["Клиент готов внести предоплату на этой неделе"],
      confidence: 0.88,
    },
    metrics: [
      { name: "tokens", value: 620, unit: "tokens" },
      { name: "cost", value: 0.0011, unit: "usd" },
      { name: "latency", value: 640, unit: "ms" },
      { name: "confidence", value: 0.88 },
    ],
    evidence: ["Клиент готов внести предоплату на этой неделе"],
    latencyMs: 640,
    costUsd: 0.0011,
    logs: [
      { timestamp: createdAt, level: "info", message: "Pipeline run started." },
      { timestamp: createdAt, level: "info", message: "Lead Qualifier completed structured output." },
    ],
    startedAt: createdAt,
    finishedAt: createdAt,
    version: "1.0.0",
  },
  {
    id: "run_demo_chat_seed",
    pipelineId: "pipeline_demo_chat_classification",
    status: "succeeded",
    input: "Ваше приложение третий день не синхронизирует данные, это уже критично для нашей команды!",
    output: {
      категория: "техническая_проблема",
      тональность: "negative",
      требует_эскалации: true,
      цитаты: ["третий день не синхронизирует данные, это уже критично"],
      confidence: 0.81,
    },
    metrics: [
      { name: "tokens", value: 280, unit: "tokens" },
      { name: "cost", value: 0.0004, unit: "usd" },
      { name: "latency", value: 410, unit: "ms" },
      { name: "confidence", value: 0.81 },
    ],
    evidence: ["третий день не синхронизирует данные, это уже критично"],
    latencyMs: 410,
    costUsd: 0.0004,
    logs: [
      { timestamp: createdAt, level: "info", message: "Pipeline run started." },
      { timestamp: createdAt, level: "info", message: "Chat Classifier completed structured output." },
    ],
    startedAt: createdAt,
    finishedAt: createdAt,
    version: "1.0.0",
  },
  {
    id: "run_demo_pipeline_lab_seed",
    pipelineId: "pipeline_demo_pipeline_lab_v3",
    status: "succeeded",
    input: "Клиент: Здравствуйте, интересует трёхкомнатная квартира в центре, бюджет до 8 миллионов, ипотека в процессе одобрения. Агент: Отлично, давайте назначим показ на пятницу в 14:00. Клиент: Договорились.",
    output: {
      client_name: null,
      budget: 8000000,
      source_of_funds: ["ипотека в процессе"],
      interested_in: ["Новостройки"],
      timeline: "до 1 месяца",
      call_result: "назначен показ",
      next_step: "Показать варианты в пятницу в 14:00",
      summary: "Клиент рассматривает трёхкомнатную квартиру в центре с бюджетом до 8 млн, ипотека в процессе одобрения. Показ назначен на пятницу.",
      quality: { confidence: 0.87, decision: "AUTO_SAVE + лог" },
    },
    metrics: [
      { name: "tokens", value: 2140, unit: "tokens" },
      { name: "cost", value: 0.0038, unit: "usd" },
      { name: "latency", value: 3120, unit: "ms" },
      { name: "confidence", value: 0.87 },
    ],
    evidence: ["интересует трёхкомнатная квартира в центре, бюджет до 8 миллионов", "ипотека в процессе одобрения", "давайте назначим показ на пятницу в 14:00"],
    latencyMs: 3120,
    costUsd: 0.0038,
    logs: [
      { timestamp: createdAt, level: "info", message: "Pipeline run started." },
      { timestamp: createdAt, level: "info", message: "Fact Agent (GPT-5 mini) extracted budget and source of funds." },
      { timestamp: createdAt, level: "info", message: "Check Agent (Claude Sonnet 4.6) found no hallucinations or PII leaks." },
      { timestamp: createdAt, level: "info", message: "Quality Gate decision: AUTO_SAVE + лог (confidence 0.87)." },
    ],
    startedAt: createdAt,
    finishedAt: createdAt,
    version: "1.0.0",
  },
  {
    id: "run_ad_copy_seed",
    pipelineId: "pipeline_ad_copy_generation",
    status: "succeeded",
    input: AD_COPY_INPUT_EXAMPLE,
    output: {
      title: "2-комн. квартира 54.5 м² с видом на парк — Пресненский район",
      description:
        "Светлая квартира с дизайнерским ремонтом и панорамными окнами в тихом дворе рядом с парком. Два санузла и кладовая — редкость для этой площади. Развитая инфраструктура в шаговой доступности: школа, детский сад, метро в 5 минутах. Ипотека одобрена банками-партнёрами.",
      cta: "Записаться на просмотр сегодня",
      confidence: 0.92,
    },
    metrics: [
      { name: "tokens", value: 2380, unit: "tokens" },
      { name: "cost", value: 0.031, unit: "usd" },
      { name: "latency", value: 4120, unit: "ms" },
      { name: "confidence", value: 0.92 },
    ],
    evidence: [],
    latencyMs: 4120,
    costUsd: 0.031,
    logs: [
      { timestamp: createdAt, level: "info", message: "Pipeline run started." },
      { timestamp: createdAt, level: "info", message: "Валидация и нормализация CRM JSON пройдены." },
      { timestamp: createdAt, level: "info", message: "Benefit Extraction Agent (GPT-5 mini) определил 4 преимущества и УТП." },
      { timestamp: createdAt, level: "info", message: "Ad Generation Agent (GPT-5 mini) сформировал Title/Description/CTA." },
      { timestamp: createdAt, level: "info", message: "Self-Check Agent (GPT-5 mini) подтвердил факты, стиль и SEO без правок." },
      { timestamp: createdAt, level: "info", message: "Quality Gate: confidence 0.92 >= 0.90 -> сохранение." },
    ],
    startedAt: createdAt,
    finishedAt: createdAt,
    version: "1.0.0",
  },
];

const projects: Project[] = [
  {
    id: "project_demo_call_analysis",
    name: "AI Call Analysis",
    description: "Демонстрационный проект анализа клиентских звонков.",
    status: "testing",
    productId: "product_demo_call_analysis",
    architectureId: "architecture_demo_call_analysis",
    pipelineId: "pipeline_demo_call_analysis",
    playgroundRunIds: ["run_demo_seed"],
    reviewIds: ["review_product_demo", "review_architecture_demo", "review_pipeline_demo"],
    createdAt,
    updatedAt: createdAt,
    version: "1.0.0",
  },
  {
    id: "project_demo_lead_qualification",
    name: "Lead Qualification",
    description: "Демонстрационный проект приоритизации входящих лидов по платежеспособности и сроку покупки.",
    status: "testing",
    productId: "product_demo_lead_qualification",
    architectureId: "architecture_demo_lead_qualification",
    pipelineId: "pipeline_demo_lead_qualification",
    playgroundRunIds: ["run_demo_lead_seed"],
    reviewIds: ["review_product_lead", "review_architecture_lead", "review_pipeline_lead"],
    createdAt,
    updatedAt: createdAt,
    version: "1.0.0",
  },
  {
    id: "project_demo_chat_classification",
    name: "Chat Classification",
    description: "Демонстрационный проект классификации сообщений чата поддержки.",
    status: "testing",
    productId: "product_demo_chat_classification",
    architectureId: "architecture_demo_chat_classification",
    pipelineId: "pipeline_demo_chat_classification",
    playgroundRunIds: ["run_demo_chat_seed"],
    reviewIds: ["review_product_chat", "review_architecture_chat", "review_pipeline_chat"],
    createdAt,
    updatedAt: createdAt,
    version: "1.0.0",
  },
  {
    id: "project_demo_pipeline_lab_v3",
    name: "Pipeline Lab v3 — Анализ звонков (Недвижимость)",
    description: "10-этапный пайплайн анализа звонков по недвижимости с реальными вызовами OpenAI/Anthropic (BYOK) в Pipeline Lab v3 -- см. вкладку «Pipeline Lab v3».",
    status: "testing",
    productId: "product_demo_pipeline_lab_v3",
    architectureId: "architecture_demo_pipeline_lab_v3",
    pipelineId: "pipeline_demo_pipeline_lab_v3",
    playgroundRunIds: ["run_demo_pipeline_lab_seed"],
    reviewIds: ["review_product_pl", "review_architecture_pl", "review_pipeline_pl"],
    createdAt,
    updatedAt: createdAt,
    version: "1.0.0",
  },
  {
    id: "project_ad_copy_generation",
    name: "Генерация текстов объявлений",
    description: "AI автоматически создаёт продающее объявление объекта недвижимости на основе структурированных данных CRM (9-этапный pipeline, Playground с реальным запуском).",
    status: "testing",
    productId: "product_ad_copy_generation",
    architectureId: "architecture_ad_copy_generation",
    pipelineId: "pipeline_ad_copy_generation",
    playgroundRunIds: ["run_ad_copy_seed"],
    reviewIds: ["review_product_ad", "review_architecture_ad", "review_pipeline_ad"],
    createdAt,
    updatedAt: createdAt,
    version: "1.0.0",
  },
];

export const demoSnapshot: RepositorySnapshot = {
  projects,
  products: [product, productLead, productChat, productPipelineLab, productAdCopy],
  architectures: [architecture, architectureLead, architectureChat, architecturePipelineLab, architectureAdCopy],
  pipelines: [pipeline, pipelineLead, pipelineChat, pipelinePipelineLab, pipelineAdCopy],
  runs,
  reviews,
  frameworks,
  knowledgeModules,
  models,
  prompts,
};

