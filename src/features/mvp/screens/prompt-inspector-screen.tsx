"use client";

import * as React from "react";
import { Badge, Card, EmptyState, Page, Section } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { seededPromptRegistry } from "@/shared/prompts/seed-prompts";
import { extractVariableNames } from "@/shared/prompts/prompt-registry";

/**
 * Read-only Prompt Registry viewer (CLAUDE.md §15/§17). No editing --
 * per the MVP scope, prompts are versioned code artifacts, not
 * something a Product Manager edits from this screen. This repository's
 * real-stage.ts (§12.4a) sends the rendered template as a single user
 * message with no separate system prompt, so this view honestly shows
 * one "Template" per prompt rather than a fabricated system/user split.
 */
export function PromptInspectorScreen() {
  const { snapshot } = useRepositoryStore();
  const promptIds = seededPromptRegistry.promptIds();
  const [selectedId, setSelectedId] = React.useState<string | null>(promptIds[0] ?? null);

  if (promptIds.length === 0) {
    return <EmptyState>В Prompt Registry ничего не зарегистрировано.</EmptyState>;
  }

  const catalogEntry = snapshot?.prompts.find((prompt) => prompt.id === selectedId);
  const versions = selectedId ? seededPromptRegistry.versions(selectedId) : [];
  const latest = versions[versions.length - 1];

  return (
    <Page className="max-w-none">
      <div>
        <h1 className="text-2xl font-semibold">Prompt Inspector</h1>
        <p className="text-sm text-text-muted">Просмотр Prompt Registry: версии, шаблон, переменные, поддерживаемые модели. Только чтение.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Section>
          <h2 className="mb-2 text-lg font-semibold">Prompts</h2>
          <div className="grid gap-2">
            {promptIds.map((id) => {
              const prompt = snapshot?.prompts.find((p) => p.id === id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedId(id)}
                  className={`rounded-md border p-2 text-left text-sm ${selectedId === id ? "border-primary bg-selected" : "border-border hover:bg-hover"}`}
                >
                  <p className="font-medium">{prompt?.name ?? id}</p>
                  <p className="text-xs text-text-muted">{id}</p>
                </button>
              );
            })}
          </div>
        </Section>

        <Section>
          {!selectedId || !latest ? (
            <EmptyState>Выберите prompt слева.</EmptyState>
          ) : (
            <Card className="grid gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold">{catalogEntry?.name ?? selectedId}</p>
                  <p className="text-xs text-text-muted">id: {selectedId}</p>
                </div>
                <div className="flex gap-2">
                  <Badge tone="info">v{latest.version}</Badge>
                  {catalogEntry ? <Badge tone={catalogEntry.status === "ready" ? "success" : "neutral"}>{catalogEntry.status}</Badge> : null}
                </div>
              </div>

              {catalogEntry?.description ? <p className="text-sm text-text-muted">{catalogEntry.description}</p> : null}

              <div>
                <p className="mb-1 text-xs font-medium text-text-muted">Template (отправляется как единственное user-сообщение — отдельного system prompt в текущей реализации нет)</p>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{latest.template}</pre>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-text-muted">Переменные</p>
                <div className="flex flex-wrap gap-2">
                  {extractVariableNames(latest.template).map((variable) => (
                    <Badge key={variable}>{`{{${variable}}}`}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-text-muted">История версий</p>
                <div className="grid gap-1">
                  {versions
                    .slice()
                    .reverse()
                    .map((version) => (
                      <div key={version.version} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                        <span>v{version.version}</span>
                        <span className="text-xs text-text-muted">{new Date(version.registeredAt).toLocaleString("ru-RU")}</span>
                      </div>
                    ))}
                </div>
              </div>
            </Card>
          )}
        </Section>
      </div>
    </Page>
  );
}
