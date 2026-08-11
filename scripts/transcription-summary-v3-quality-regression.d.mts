export function validateDataset(dataset: unknown): string[];
export function evaluateCase(golden: any, pipelineResult: any, httpStatus?: number, durationMs?: number): any;
export function aggregateResults(caseResults: any[]): any;
export function compareWithBaseline(current: any[], baseline: any, policyFingerprint: string): any;
export function caseAcceptanceFailures(caseResults: any[]): string[];
