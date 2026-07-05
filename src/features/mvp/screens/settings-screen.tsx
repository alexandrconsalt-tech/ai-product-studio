"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { Alert, Badge, Button, Card, Input, Page, Section } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import {
  clearAnthropicApiKey,
  clearOpenAiApiKey,
  loadAnthropicApiKey,
  loadOpenAiApiKey,
  maskApiKey,
  saveAnthropicApiKey,
  saveOpenAiApiKey,
} from "@/shared/llm/browser-direct-provider";

/**
 * Centralizes the BYOK Anthropic/OpenAI keys that used to be entered
 * separately inside Pipeline Lab v3 (public/pipeline-lab-v3.html) for
 * every product. Same localStorage keys
 * (pipelineLabV3.anthropicApiKey/pipelineLabV3.openaiApiKey) --
 * saving here is immediately visible to every product's Pipeline Lab v3
 * iframe (same origin, shared localStorage) and to Product's AI Assist,
 * without the user re-entering a key per product. Pipeline Lab v3's own
 * "API-ключи" card is hidden, not deleted, for this reason.
 */
function ApiKeysSection() {
  const [anthropicKey, setAnthropicKey] = React.useState("");
  const [openAiKey, setOpenAiKey] = React.useState("");
  const [savedAnthropicKey, setSavedAnthropicKey] = React.useState("");
  const [savedOpenAiKey, setSavedOpenAiKey] = React.useState("");

  React.useEffect(() => {
    setSavedAnthropicKey(loadAnthropicApiKey());
    setSavedOpenAiKey(loadOpenAiApiKey());
  }, []);

  const handleSaveAnthropic = () => {
    if (!anthropicKey.trim()) return;
    saveAnthropicApiKey(anthropicKey.trim());
    setSavedAnthropicKey(anthropicKey.trim());
    setAnthropicKey("");
  };
  const handleClearAnthropic = () => {
    clearAnthropicApiKey();
    setSavedAnthropicKey("");
  };
  const handleSaveOpenAi = () => {
    if (!openAiKey.trim()) return;
    saveOpenAiApiKey(openAiKey.trim());
    setSavedOpenAiKey(openAiKey.trim());
    setOpenAiKey("");
  };
  const handleClearOpenAi = () => {
    clearOpenAiApiKey();
    setSavedOpenAiKey("");
  };

  return (
    <Card className="grid max-w-2xl gap-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">API-ключи</h2>
      </div>
      <p className="text-sm text-text-muted">
        Один набор ключей для всех продуктов — используется и в Песочнице (Pipeline Lab v3), и в ИИ-помощнике на карточке продукта. Ключи хранятся
        только в localStorage этого браузера и отправляются напрямую в api.anthropic.com / api.openai.com, никуда больше.
      </p>

      <div className="grid gap-2">
        <label className="grid gap-1 text-sm">
          Anthropic (для шагов с моделью «Claude Sonnet 4.6», sk-ant-…)
          <div className="flex flex-wrap items-center gap-2">
            <Input type="password" className="min-w-56 flex-1" placeholder="sk-ant-api03-..." value={anthropicKey} onChange={(event) => setAnthropicKey(event.target.value)} autoComplete="off" />
            <Button variant="secondary" onClick={handleSaveAnthropic} disabled={!anthropicKey.trim()}>Сохранить</Button>
            <Button variant="ghost" onClick={handleClearAnthropic} disabled={!savedAnthropicKey}>Удалить</Button>
          </div>
        </label>
        <Badge tone={savedAnthropicKey ? "success" : "neutral"} className="w-fit">
          {savedAnthropicKey ? `Сохранён: ${maskApiKey(savedAnthropicKey)}` : "Ключ не задан"}
        </Badge>
      </div>

      <div className="grid gap-2">
        <label className="grid gap-1 text-sm">
          OpenAI (для шагов с моделью «GPT-5 mini», sk-…)
          <div className="flex flex-wrap items-center gap-2">
            <Input type="password" className="min-w-56 flex-1" placeholder="sk-..." value={openAiKey} onChange={(event) => setOpenAiKey(event.target.value)} autoComplete="off" />
            <Button variant="secondary" onClick={handleSaveOpenAi} disabled={!openAiKey.trim()}>Сохранить</Button>
            <Button variant="ghost" onClick={handleClearOpenAi} disabled={!savedOpenAiKey}>Удалить</Button>
          </div>
        </label>
        <Badge tone={savedOpenAiKey ? "success" : "neutral"} className="w-fit">
          {savedOpenAiKey ? `Сохранён: ${maskApiKey(savedOpenAiKey)}` : "Ключ не задан"}
        </Badge>
      </div>

      <Alert tone="info">
        Anthropic-ключ создаётся на console.anthropic.com/settings/keys, OpenAI-ключ — на platform.openai.com/api-keys. Никогда не публикуйте эту
        страницу с сохранёнными ключами посторонним и удаляйте ключи после теста на чужом компьютере.
      </Alert>
    </Card>
  );
}

export function SettingsScreen() {
  const { reset } = useRepositoryStore();
  return (
    <Page>
      <div>
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <p className="text-sm text-text-muted">API-ключи для ИИ-вызовов и параметры среды выполнения.</p>
      </div>

      <Section>
        <ApiKeysSection />
      </Section>

      <Section>
        <Card className="grid max-w-2xl gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Среда выполнения</h2>
            <Badge tone="neutral">Mock LLM Provider</Badge>
          </div>
          <p className="text-sm text-text-muted">
            Песочница, Golden Dataset Evaluation и Benchmark всегда выполняются реальным Pipeline Executor, но LLM-вызовы в нём идут через Mock LLM
            Provider (без сети, без реальной модели) — поэтому оценки в Аналитике честно показывают низкий pass rate. Реальные вызовы моделей (Pipeline
            Lab v3, ИИ-помощник) используют API-ключи выше, а не этот Runtime.
          </p>
        </Card>
      </Section>

      <Section>
        <Card className="grid max-w-2xl gap-2">
          <h2 className="text-lg font-semibold">Данные</h2>
          <p className="text-sm text-text-muted">MVP использует Local Storage Repository. Можно сбросить данные к Demo Project.</p>
          <Button className="w-fit" onClick={reset}>Сбросить Demo Repository</Button>
        </Card>
      </Section>
    </Page>
  );
}
