"use client";

import * as React from "react";
import { Background, Controls, MiniMap, ReactFlow, addEdge, type Connection, type Edge as FlowEdge, type Node as FlowNode, type NodeChange, type EdgeChange, applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import { Copy, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import { Button, Card, EmptyState, Input, Select, Textarea, Toolbar, IconButton } from "@/shared/ui";
import { createNode } from "@/entities/Node/model/factory";
import type { Node, NodeType } from "@/entities/Node/model/types";
import type { Edge } from "@/entities/Edge/model/types";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { usePipelineStore } from "@/shared/stores/pipeline-store";
import { getProjectBundle } from "../selectors";

const nodeTypes: readonly NodeType[] = ["input", "agent", "llm", "tool", "function", "router", "store", "validation", "human_review", "output"];

function toFlowNodes(nodes: readonly Node[]): FlowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "default",
    position: node.position ?? { x: 0, y: 0 },
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
    label: edge.condition?.expression,
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

  React.useEffect(() => {
    if (!pipeline) return;
    setFlowNodes(toFlowNodes(pipeline.nodes));
    setFlowEdges(toFlowEdges(pipeline.edges));
  }, [pipeline?.id, pipeline?.nodes, pipeline?.edges, pipeline]);

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
        <div className="min-w-0 flex-1">
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
