"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { Alert, Badge, Button, Card, Input, Page, Section, Select } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import {
  clearAnthropicApiKey,
  clearAiTunnelApiKey,
  clearOpenAiApiKey,
  DEFAULT_AI_TUNNEL_BASE_URL,
  loadAiTunnelApiKey,
  loadAiTunnelBaseUrl,
  loadAnthropicApiKey,
  loadOpenAiApiKey,
  loadSelectedLlmProvider,
  maskApiKey,
  MODEL_OPTIONS,
  saveAiTunnelSettings,
  saveAnthropicApiKey,
  saveOpenAiApiKey,
  saveSelectedLlmProvider,
  testAiTunnelConnection,
  type AiTunnelConnectionResult,
  type SelectedLlmProvider,
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
  const [aiTunnelKey, setAiTunnelKey] = React.useState("");
  const [aiTunnelBaseUrl, setAiTunnelBaseUrl] = React.useState(DEFAULT_AI_TUNNEL_BASE_URL);
  const [savedAiTunnelKey, setSavedAiTunnelKey] = React.useState("");
  const [selectedProvider, setSelectedProvider] = React.useState<SelectedLlmProvider>("mock");
  const [testModel, setTestModel] = React.useState("gpt-5-mini");
  const [connectionResult, setConnectionResult] = React.useState<AiTunnelConnectionResult | null>(null);
  const [isTesting, setIsTesting] = React.useState(false);

  React.useEffect(() => {
    setSavedAnthropicKey(loadAnthropicApiKey());
    setSavedOpenAiKey(loadOpenAiApiKey());
    setSavedAiTunnelKey(loadAiTunnelApiKey());
    setAiTunnelBaseUrl(loadAiTunnelBaseUrl());
    setSelectedProvider(loadSelectedLlmProvider());
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
  const handleSaveAiTunnel = () => {
    if (!aiTunnelKey.trim()) return;
    saveAiTunnelSettings(aiTunnelKey.trim(), aiTunnelBaseUrl.trim() || DEFAULT_AI_TUNNEL_BASE_URL);
    setSavedAiTunnelKey(aiTunnelKey.trim());
    setAiTunnelBaseUrl(aiTunnelBaseUrl.trim() || DEFAULT_AI_TUNNEL_BASE_URL);
    setAiTunnelKey("");
    setConnectionResult(null);
  };
  const handleClearAiTunnel = () => {
    clearAiTunnelApiKey();
    setSavedAiTunnelKey("");
    setAiTunnelKey("");
    setConnectionResult(null);
  };
  const handleProviderChange = (provider: SelectedLlmProvider) => {
    setSelectedProvider(provider);
    saveSelectedLlmProvider(provider);
  };
  const handleTestAiTunnel = async () => {
    setIsTesting(true);
    setConnectionResult(null);
    const result = await testAiTunnelConnection(testModel);
    setConnectionResult(result);
    setIsTesting(false);
  };

  const connectionLabels: Record<AiTunnelConnectionResult, string> = {
    success: "Подключение работает",
    "invalid-key": "Неверный API-ключ",
    "insufficient-funds": "Недостаточно средств",
    "model-unavailable": "Модель недоступна",
    "rate-limit": "Превышен лимит",
    "network-error": "Сетевая ошибка",
    "unknown-error": "Неизвестная ошибка",
  };

  return (
    <Card className="grid max-w-2xl gap-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">API-ключи</h2>
      </div>
      <p className="text-sm text-text-muted">
        Один набор ключей для всех продуктов — используется и в Песочнице (Pipeline Lab v3), и в ИИ-помощнике на карточке продукта. Ключи хранятся
        только в localStorage этого браузера. В зависимости от выбранного провайдера запросы отправляются напрямую в OpenAI, Anthropic или через AI Tunnel.
      </p>

      <label className="grid gap-1 text-sm">
        LLM-провайдер
        <Select value={selectedProvider} onChange={(event) => handleProviderChange(event.target.value as SelectedLlmProvider)}>
          <option value="ai-tunnel">AI Tunnel</option>
          <option value="openai-direct">OpenAI Direct</option>
          <option value="anthropic-direct">Anthropic Direct</option>
          <option value="mock">Mock LLM Provider</option>
        </Select>
      </label>

      <div className="grid gap-3 rounded-md border border-border p-3">
        <h3 className="font-medium">AI Tunnel</h3>
        <label className="grid gap-1 text-sm">
          API key
          <Input type="password" placeholder="sk-aitunnel-..." value={aiTunnelKey} onChange={(event) => setAiTunnelKey(event.target.value)} autoComplete="off" />
        </label>
        <label className="grid gap-1 text-sm">
          Base URL
          <Input value={aiTunnelBaseUrl} onChange={(event) => setAiTunnelBaseUrl(event.target.value)} autoComplete="off" />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleSaveAiTunnel} disabled={!aiTunnelKey.trim()}>Сохранить</Button>
          <Button variant="ghost" onClick={handleClearAiTunnel} disabled={!savedAiTunnelKey}>Удалить</Button>
        </div>
        <Badge tone={savedAiTunnelKey ? "success" : "neutral"} className="w-fit">
          {savedAiTunnelKey ? `Сохранён: ${maskApiKey(savedAiTunnelKey)}` : "Ключ не задан"}
        </Badge>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Select aria-label="Тестовая модель AI Tunnel" value={testModel} onChange={(event) => setTestModel(event.target.value)}>
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.value}</option>
            ))}
          </Select>
          <Button onClick={handleTestAiTunnel} disabled={!savedAiTunnelKey || isTesting}>{isTesting ? "Проверка…" : "Проверить подключение"}</Button>
        </div>
        {connectionResult ? <Alert tone={connectionResult === "success" ? "success" : "error"}>{connectionLabels[connectionResult]}</Alert> : null}
      </div>

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
      <Alert tone="warning">Не используйте персональные production-ключи на чужом или общем компьютере. Для production-развёртывания ключи должны храниться на сервере.</Alert>
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
