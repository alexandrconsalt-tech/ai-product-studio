"use client";

import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type { Edge } from "@/entities/Edge/model/types";
import type { Node } from "@/entities/Node/model/types";
import type { Pipeline } from "@/entities/Pipeline/model/types";
import { createTimestamp } from "@/entities/shared";
import { useRepositoryStore } from "./repository-store";

type PipelineStore = Readonly<{
  selectedNodeId: string | null;
  history: Readonly<Record<string, Readonly<{ past: readonly Pipeline[]; future: readonly Pipeline[] }>>>;
  setSelectedNodeId: (nodeId: string | null) => void;
  updatePipeline: (pipeline: Pipeline) => void;
  updateNode: (pipelineId: string, node: Node) => void;
  addNode: (pipelineId: string, node: Node) => void;
  deleteNode: (pipelineId: string, nodeId: string) => void;
  duplicateNode: (pipelineId: string, nodeId: string) => void;
  setNodesAndEdges: (pipelineId: string, nodes: readonly Node[], edges: readonly Edge[]) => void;
  undo: (pipelineId: string) => void;
  redo: (pipelineId: string) => void;
  canUndo: (pipelineId: string) => boolean;
  canRedo: (pipelineId: string) => boolean;
}>;

const updatePipelineById = (pipelineId: string, updater: (pipeline: Pipeline) => Pipeline, recordHistory = true): void => {
  const repository = useRepositoryStore.getState();
  const snapshot = repository.snapshot;
  if (!snapshot) return;
  const currentPipeline = snapshot.pipelines.find((pipeline) => pipeline.id === pipelineId);
  if (!currentPipeline) return;
  if (recordHistory) {
    usePipelineStore.setState((state: PipelineStore) => {
      const current = state.history[pipelineId] ?? { past: [], future: [] };
      return {
        history: {
          ...state.history,
          [pipelineId]: { past: [...current.past, currentPipeline].slice(-50), future: [] },
        },
      };
    });
  }
  repository.setSnapshot({
    ...snapshot,
    pipelines: snapshot.pipelines.map((pipeline) => (pipeline.id === pipelineId ? updater(pipeline) : pipeline)),
  });
};

export const usePipelineStore: UseBoundStore<StoreApi<PipelineStore>> = create<PipelineStore>((set) => ({
  selectedNodeId: null,
  history: {},
  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
  updatePipeline: (pipeline) => updatePipelineById(pipeline.id, () => ({ ...pipeline, updatedAt: createTimestamp() })),
  updateNode: (pipelineId, node) =>
    updatePipelineById(pipelineId, (pipeline) => ({
      ...pipeline,
      nodes: pipeline.nodes.map((item) => (item.id === node.id ? node : item)),
      updatedAt: createTimestamp(),
    })),
  addNode: (pipelineId, node) =>
    updatePipelineById(pipelineId, (pipeline) => ({
      ...pipeline,
      nodes: [...pipeline.nodes, node],
      updatedAt: createTimestamp(),
    })),
  deleteNode: (pipelineId, nodeId) =>
    updatePipelineById(pipelineId, (pipeline) => ({
      ...pipeline,
      nodes: pipeline.nodes.filter((node) => node.id !== nodeId),
      edges: pipeline.edges.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId),
      updatedAt: createTimestamp(),
    })),
  duplicateNode: (pipelineId, nodeId) =>
    updatePipelineById(pipelineId, (pipeline) => {
      const node = pipeline.nodes.find((item) => item.id === nodeId);
      if (!node) return pipeline;
      const duplicate: Node = {
        ...node,
        id: `node_${crypto.randomUUID()}`,
        name: `${node.name} Copy`,
        position: node.position ? { x: node.position.x + 40, y: node.position.y + 40 } : undefined,
      };
      return { ...pipeline, nodes: [...pipeline.nodes, duplicate], updatedAt: createTimestamp() };
    }),
  setNodesAndEdges: (pipelineId, nodes, edges) =>
    updatePipelineById(pipelineId, (pipeline) => ({
      ...pipeline,
      nodes,
      edges,
      updatedAt: createTimestamp(),
    })),
  undo: (pipelineId) => {
    const repository = useRepositoryStore.getState();
    const snapshot = repository.snapshot;
    const history = usePipelineStore.getState().history[pipelineId];
    const previous = history?.past[history.past.length - 1];
    const current = snapshot?.pipelines.find((pipeline) => pipeline.id === pipelineId);
    if (!snapshot || !history || !previous || !current) return;
    usePipelineStore.setState({
      history: {
        ...usePipelineStore.getState().history,
        [pipelineId]: { past: history.past.slice(0, -1), future: [current, ...history.future].slice(0, 50) },
      },
    });
    repository.setSnapshot({
      ...snapshot,
      pipelines: snapshot.pipelines.map((pipeline) => (pipeline.id === pipelineId ? previous : pipeline)),
    });
  },
  redo: (pipelineId) => {
    const repository = useRepositoryStore.getState();
    const snapshot = repository.snapshot;
    const history = usePipelineStore.getState().history[pipelineId];
    const next = history?.future[0];
    const current = snapshot?.pipelines.find((pipeline) => pipeline.id === pipelineId);
    if (!snapshot || !history || !next || !current) return;
    usePipelineStore.setState({
      history: {
        ...usePipelineStore.getState().history,
        [pipelineId]: { past: [...history.past, current].slice(-50), future: history.future.slice(1) },
      },
    });
    repository.setSnapshot({
      ...snapshot,
      pipelines: snapshot.pipelines.map((pipeline) => (pipeline.id === pipelineId ? next : pipeline)),
    });
  },
  canUndo: (pipelineId) => Boolean(usePipelineStore.getState().history[pipelineId]?.past.length),
  canRedo: (pipelineId) => Boolean(usePipelineStore.getState().history[pipelineId]?.future.length),
}));
