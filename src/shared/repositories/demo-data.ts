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

const reviews: Review[] = [
  { id: "review_product_demo", targetType: "product", targetId: "product_demo_call_analysis", status: "approved", score: 91, issues: [], reviewerModuleId: "knowledge_spm", createdAt, version: "1.0.0" },
  { id: "review_architecture_demo", targetType: "architecture", targetId: "architecture_demo_call_analysis", status: "approved", score: 93, issues: [], reviewerModuleId: "knowledge_architect", createdAt, version: "1.0.0" },
  { id: "review_pipeline_demo", targetType: "pipeline", targetId: "pipeline_demo_call_analysis", status: "approved", score: 89, issues: [], createdAt, version: "1.0.0" },
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
];

export const demoSnapshot: RepositorySnapshot = {
  projects,
  products: [product],
  architectures: [architecture],
  pipelines: [pipeline],
  runs,
  reviews,
  frameworks,
  knowledgeModules,
  models,
  prompts,
};

