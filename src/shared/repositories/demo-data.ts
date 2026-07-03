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
];

export const demoSnapshot: RepositorySnapshot = {
  projects,
  products: [product, productLead, productChat],
  architectures: [architecture, architectureLead, architectureChat],
  pipelines: [pipeline, pipelineLead, pipelineChat],
  runs,
  reviews,
  frameworks,
  knowledgeModules,
  models,
  prompts,
};

