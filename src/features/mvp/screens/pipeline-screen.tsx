"use client";

import * as React from "react";
import { Background, Controls, MiniMap, ReactFlow, addEdge, useUpdateNodeInternals, type Connection, type Edge as FlowEdge, type Node as FlowNode, type NodeChange, type EdgeChange, applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import { Copy, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import { Button, Card, EmptyState, Input, Select, Textarea, Toolbar, IconButton } from "@/shared/ui";
import { createNode } from "@/entities/Node/model/factory";
import type { Node, NodeType } from "@/entities/Node/model/types";
import type { Edge, EdgeCondition, EdgeConditionOperator } from "@/entities/Edge/model/types";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { usePipelineStore } from "@/shared/stores/pipeline-store";
import { getProjectBundle } from "../selectors";

const nodeTypes: readonly NodeType[] = ["input", "agent", "llm", "tool", "function", "router", "store", "validation", "human_review", "output"];

const CONDITION_OPERATOR_SYMBOLS: Record<EdgeConditionOperator, string> = {
  eq: "=",
  neq: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

function formatEdgeCondition(condition: EdgeCondition | undefined): string | undefined {
  if (!condition) return undefined;
  return `${condition.field} ${CONDITION_OPERATOR_SYMBOLS[condition.operator]} ${condition.value}`;
}

/**
 * React Flow's automatic ResizeObserver-based node measurement was
 * never completing in this app for nodes set via props after mount
 * (as opposed to `initialNodes`) -- nodes stayed `visibility: hidden`
 * indefinitely and, even after giving them explicit width/height,
 * `node.internals.handleBounds` (required before any edge connected
 * to that node will render) still never got computed. React Flow's
 * own docs recommend calling `useUpdateNodeInternals` explicitly for
 * nodes that appear/change after the initial render, rather than
 * relying solely on the automatic observer. This must be a child of
 * `<ReactFlow>` (the hook requires `ReactFlowProvider` context), which
 * is why it is a separate component rendered inside it rather than
 * called directly in `PipelineScreen`. See CLAUDE.md §63 debt item 12.
 */
function NodeInternalsSync({ nodeIds }: { nodeIds: readonly string[] }) {
  const updateNodeInternals = useUpdateNodeInternals();
  React.useEffect(() => {
    if (nodeIds.length > 0) updateNodeInternals([...nodeIds]);
  }, [nodeIds, updateNodeInternals]);
  return null;
}

function toFlowNodes(nodes: readonly Node[]): FlowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "default",
    position: node.position ?? { x: 0, y: 0 },
    // Explicit width/height lets React Flow compute handle positions and
    // edge anchors immediately instead of waiting on its internal
    // ResizeObserver-based auto-measurement pass, which was never
    // completing in this app (nodes stayed permanently `visibility:
    // hidden`, 0 edges ever rendered -- see CLAUDE.md §63 debt item 12,
    // Cause B). Values are a reasonable fixed default node size.
    width: 180,
    height: 40,
    data: {
      label: `${node.name} · ${node.type}`,
    },
  }));
}

function toFlowEdges(edges: readonly Edge[]): FlowEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    label: formatEdgeCondition(edge.condition),
  }));
}

function fromFlow(flowNodes: readonly FlowNode[], flowEdges: readonly FlowEdge[], sourceNodes: readonly Node[], sourceEdges: readonly Edge[]): { nodes: Node[]; edges: Edge[] } {
  const nodes = sourceNodes.map((node) => {
    const flowNode = flowNodes.find((item) => item.id === node.id);
    return flowNode ? { ...node, position: flowNode.position } : node;
  });
  const edges = flowEdges.map((flowEdge) => {
    const source = sourceEdges.find((edge) => edge.id === flowEdge.id);
    return {
      id: flowEdge.id,
      sourceNodeId: flowEdge.source,
      targetNodeId: flowEdge.target,
      sourcePortId: source?.sourcePortId,
      targetPortId: source?.targetPortId,
      condition: source?.condition,
      version: source?.version ?? "1.0.0",
    };
  });
  return { nodes, edges };
}

export function PipelineScreen() {
  const { snapshot, selectedProjectId } = useRepositoryStore();
  const { selectedNodeId, history, setSelectedNodeId, addNode, deleteNode, duplicateNode, updateNode, setNodesAndEdges, undo, redo } = usePipelineStore();
  const { pipeline } = getProjectBundle(snapshot, selectedProjectId);
  const [flowNodes, setFlowNodes] = React.useState<FlowNode[]>([]);
  const [flowEdges, setFlowEdges] = React.useState<FlowEdge[]>([]);
  // Memoized so it only changes when `flowNodes` itself actually changes
  // (via setFlowNodes), not on every PipelineScreen re-render -- an
  // inline `flowNodes.map(...)` in the JSX below would create a new
  // array every render, which fed back into an update loop via
  // NodeInternalsSync's effect.
  const flowNodeIds = React.useMemo(() => flowNodes.map((node) => node.id), [flowNodes]);

  React.useEffect(() => {
    if (!pipeline) return;
    setFlowNodes(toFlowNodes(pipeline.nodes));
    setFlowEdges(toFlowEdges(pipeline.edges));
    // Deliberately depend only on pipeline.id/nodes/edges, NOT the whole
    // `pipeline` object: `getProjectBundle` returns a fresh object every
    // render, so including it here caused this effect to re-run on every
    // render forever, continuously replacing flowNodes/flowEdges with new
    // array instances. That render loop was the actual root cause of
    // React Flow never finishing its node-measurement pass (nodes stayed
    // `visibility: hidden`, and 0 edges ever rendered) -- see CLAUDE.md
    // §63 debt item 12, Cause B.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline?.id, pipeline?.nodes, pipeline?.edges]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!pipeline) return;
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) {
        redo(pipeline.id);
      } else {
        undo(pipeline.id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pipeline, redo, undo]);

  if (!pipeline) {
    return <EmptyState>Pipeline станет доступен после Architecture Complete gate.</EmptyState>;
  }

  const selectedNode = pipeline.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const pipelineHistory = history[pipeline.id] ?? { past: [], future: [] };
  const canUndo = pipelineHistory.past.length > 0;
  const canRedo = pipelineHistory.future.length > 0;

  const persistFlow = (nextNodes: readonly FlowNode[], nextEdges: readonly FlowEdge[]) => {
    const converted = fromFlow(nextNodes, nextEdges, pipeline.nodes, pipeline.edges);
    setNodesAndEdges(pipeline.id, converted.nodes, converted.edges);
  };

  const handleNodesChange = (changes: NodeChange[]) => {
    const nextNodes = applyNodeChanges(changes, flowNodes);
    setFlowNodes(nextNodes);
    persistFlow(nextNodes, flowEdges);
  };

  const handleEdgesChange = (changes: EdgeChange[]) => {
    const nextEdges = applyEdgeChanges(changes, flowEdges);
    setFlowEdges(nextEdges);
    persistFlow(flowNodes, nextEdges);
  };

  const handleConnect = (connection: Connection) => {
    const nextEdges = addEdge({ ...connection, id: `edge_${crypto.randomUUID()}` }, flowEdges);
    setFlowEdges(nextEdges);
    persistFlow(flowNodes, nextEdges);
  };

  const handleAddNode = () => {
    const node = createNode({
      type: "function",
      name: "New Function",
      description: "Новый шаг Pipeline.",
      position: { x: 120, y: 120 },
      metadata: { createdBy: "mvp" },
    });
    addNode(pipeline.id, node);
    setSelectedNodeId(node.id);
  };

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-0 flex-col">
      <Toolbar className="justify-between">
        <div className="flex items-center gap-1">
          <Button onClick={handleAddNode}>
            <Plus className="size-4" aria-hidden="true" />
            Add Node
          </Button>
          <IconButton aria-label="Undo" variant="ghost" disabled={!canUndo} onClick={() => undo(pipeline.id)}>
            <Undo2 className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton aria-label="Redo" variant="ghost" disabled={!canRedo} onClick={() => redo(pipeline.id)}>
            <Redo2 className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton aria-label="Дублировать Node" variant="ghost" disabled={!selectedNode} onClick={() => selectedNode && duplicateNode(pipeline.id, selectedNode.id)}>
            <Copy className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton aria-label="Удалить Node" variant="ghost" disabled={!selectedNode} onClick={() => selectedNode && deleteNode(pipeline.id, selectedNode.id)}>
            <Trash2 className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        <span className="text-sm text-text-muted">{pipeline.nodes.length} nodes · {pipeline.edges.length} edges · Undo {pipelineHistory.past.length}</span>
      </Toolbar>
      <div className="flex min-h-0 flex-1">
        <div className="h-full min-w-[320px] flex-1">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
          >
            <NodeInternalsSync nodeIds={flowNodeIds} />
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
        <NodeInspector node={selectedNode} models={snapshot?.models ?? []} prompts={snapshot?.prompts ?? []} onChange={(node) => updateNode(pipeline.id, node)} />
      </div>
    </div>
  );
}

type NodeInspectorProps = Readonly<{
  node: Node | null;
  models: readonly { id: string; name: string }[];
  prompts: readonly { id: string; name: string }[];
  onChange: (node: Node) => void;
}>;

function NodeInspector({ node, models, prompts, onChange }: NodeInspectorProps) {
  if (!node) {
    return <aside className="w-[360px] border-l border-border bg-surface p-4 text-sm text-text-muted">Выберите Node, чтобы изменить свойства.</aside>;
  }

  const update = (patch: Partial<Node>) => onChange({ ...node, ...patch });
  const metadataText = Object.entries(node.metadata).map(([key, value]) => `${key}: ${value}`).join("\n");

  return (
    <aside className="w-[360px] overflow-auto border-l border-border bg-surface p-4">
      <Card className="grid gap-3">
        <h2 className="text-lg font-semibold">Inspector</h2>
        <label className="grid gap-1 text-sm">
          Name
          <Input value={node.name} onChange={(event) => update({ name: event.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">
          Type
          <Select value={node.type} onChange={(event) => update({ type: event.target.value as NodeType })}>
            {nodeTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          Description
          <Textarea value={node.description ?? ""} onChange={(event) => update({ description: event.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">
          Model
          <Select value={node.modelId ?? ""} onChange={(event) => update({ modelId: event.target.value || undefined })}>
            <option value="">No model</option>
            {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          Prompt
          <Select value={node.promptId ?? ""} onChange={(event) => update({ promptId: event.target.value || undefined })}>
            <option value="">No prompt</option>
            {prompts.map((prompt) => <option key={prompt.id} value={prompt.id}>{prompt.name}</option>)}
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          Temperature
          <Input type="number" min={0} max={2} step={0.1} value={node.temperature ?? 0} onChange={(event) => update({ temperature: Number(event.target.value) })} />
        </label>
        <label className="grid gap-1 text-sm">
          Tools
          <Input value={node.tools.join(", ")} onChange={(event) => update({ tools: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
        </label>
        <label className="grid gap-1 text-sm">
          Metadata
          <Textarea
            value={metadataText}
            onChange={(event) => {
              const metadata = Object.fromEntries(
                event.target.value
                  .split("\n")
                  .map((line) => line.split(":"))
                  .filter((parts) => parts[0]?.trim())
                  .map(([key, ...value]) => [key.trim(), value.join(":").trim()]),
              );
              update({ metadata });
            }}
          />
        </label>
      </Card>
    </aside>
  );
}
