// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SettingsScreen } from "./settings-screen";

describe("SettingsScreen AI Tunnel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/models/images")) return new Response(JSON.stringify({ "image-alpha": { provider: "test", supports_edit: true, max_input_references: 2 }, "text-to-image-only": { supports_edit: false, max_input_references: 0 } }));
      if (url.endsWith("/models/chat")) return new Response(JSON.stringify({ "vision-alpha": { provider: "test", modalities: { input: ["text", "image"] } }, "text-only": { modalities: { input: ["text"] } } }));
      return new Response(JSON.stringify({ choices: [{ message: { content: "работает" } }] }));
    }));
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("saves, masks, restores and removes the AI Tunnel key", async () => {
    const { unmount } = render(<SettingsScreen />);
    fireEvent.change(screen.getAllByLabelText("API key")[0], { target: { value: "sk-aitunnel-secret-VQeY" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Сохранить" })[0]);

    expect(window.localStorage.getItem("aiTunnelApiKey")).toBe("sk-aitunnel-secret-VQeY");
    expect(screen.getByText("Сохранён: sk-aitunne…VQeY")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("sk-aitunnel-secret-VQeY")).not.toBeInTheDocument();

    unmount();
    render(<SettingsScreen />);
    expect(await screen.findByText("Сохранён: sk-aitunne…VQeY")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Удалить" })[0]);
    expect(window.localStorage.getItem("aiTunnelApiKey")).toBeNull();
    expect(screen.getAllByText("Ключ не задан").length).toBeGreaterThan(0);
  });

  it("checks the selected model without showing the API response", async () => {
    window.localStorage.setItem("aiTunnelApiKey", "sk-aitunnel-secret");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/models/images")) return new Response(JSON.stringify({}));
      if (url.endsWith("/models/chat")) return new Response(JSON.stringify({}));
      return new Response(JSON.stringify({ choices: [{ message: { content: "работает and secret response" } }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SettingsScreen />);

    fireEvent.change(screen.getByLabelText("Тестовая модель AI Tunnel"), { target: { value: "claude-sonnet-4-6" } });
    fireEvent.click(screen.getByRole("button", { name: "Проверить подключение" }));

    expect(await screen.findByText("Подключение работает")).toBeInTheDocument();
    expect(screen.queryByText(/secret response/)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("использует общий AI Tunnel key для Floor Plan", async () => {
    window.localStorage.setItem("aiTunnelApiKey", "sk-shared-floor-plan-1234");
    render(<SettingsScreen />);
    expect(screen.getByText("Используется общий: sk-shared-…1234")).toBeInTheDocument();
    expect(screen.getByText(/Модели и промпты каждого этапа/)).toBeInTheDocument();
  });

  it("сохраняет отдельное подключение Floor Plan", async () => {
    render(<SettingsScreen />);
    fireEvent.change(screen.getByLabelText("AI Tunnel API key для AI Floor Plan"), { target: { value: "sk-floor-plan" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить подключение" }));
    expect(JSON.parse(window.localStorage.getItem("ai-floor-plan.aitunnel-settings.v2") ?? "{}").apiKey).toBe("sk-floor-plan");
    expect(screen.getByText("Подключение AI Floor Plan сохранено.")).toBeInTheDocument();
  });
});
