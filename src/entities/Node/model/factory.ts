import { createEntityId } from "@/entities/shared";
import type { Node, NodePort } from "./types";

export function createNode(
  input: Omit<Node, "id" | "inputPorts" | "outputPorts" | "tools" | "metadata" | "version"> &
    Partial<Pick<Node, "id" | "inputPorts" | "outputPorts" | "tools" | "metadata" | "version">>,
): Node {
  return {
    id: input.id ?? createEntityId("node"),
    type: input.type,
    name: input.name,
    description: input.description,
    inputPorts: input.inputPorts ?? [],
    outputPorts: input.outputPorts ?? [],
    modelId: input.modelId,
    promptId: input.promptId,
    temperature: input.temperature,
    tools: input.tools ?? [],
    metadata: input.metadata ?? {},
    position: input.position,
    version: input.version ?? "1.0.0",
  };
}

export function createNodePort(input: Omit<NodePort, "id"> & Partial<Pick<NodePort, "id">>): NodePort {
  return {
    id: input.id ?? createEntityId("port"),
    name: input.name,
    schemaRef: input.schemaRef,
  };
}
