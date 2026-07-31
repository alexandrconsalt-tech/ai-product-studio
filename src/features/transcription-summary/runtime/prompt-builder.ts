import { createHash } from "node:crypto";
import type { ContractDefinition } from "../contracts/contract-types";
import { stableStringify } from "../contracts/schema-utils";

export type ResolvedPrompt = Readonly<{
  basePrompt: string;
  resolvedPrompt: string;
  promptVersion: string;
  promptHash: string;
  contractId: string;
  contractVersion: string;
  schemaHash: string;
}>;

export function buildStructuredPrompt(input: {
  systemRole: string;
  businessInstruction: string;
  promptVersion: string;
  contract: ContractDefinition;
  inputData: unknown;
}): ResolvedPrompt {
  const basePrompt = [
    `SYSTEM ROLE\n${input.systemRole}`,
    `BUSINESS INSTRUCTION\n${input.businessInstruction}`,
  ].join("\n\n");
  const canonical = input.contract.canonicalEnums.length
    ? `\n\nCANONICAL DICTIONARIES\n${stableStringify(input.contract.canonicalEnums)}`
    : "";
  const resolvedPrompt = [
    basePrompt,
    `CONTRACT REFERENCE\n${input.contract.id}@${input.contract.version}\nschema_hash=${input.contract.schemaHash}${canonical}`,
    `INPUT DATA\n${stableStringify(input.inputData)}`,
  ].join("\n\n");
  return Object.freeze({
    basePrompt,
    resolvedPrompt,
    promptVersion: input.promptVersion,
    promptHash: createHash("sha256").update(resolvedPrompt).digest("hex"),
    contractId: input.contract.id,
    contractVersion: input.contract.version,
    schemaHash: input.contract.schemaHash,
  });
}
