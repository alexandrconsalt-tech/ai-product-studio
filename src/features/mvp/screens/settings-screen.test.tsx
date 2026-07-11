// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SettingsScreen } from "./settings-screen";

describe("SettingsScreen AI Tunnel", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("saves, masks, restores and removes the AI Tunnel key", async () => {
    const { unmount } = render(<SettingsScreen />);
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "sk-aitunnel-secret-VQeY" } });
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
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "работает and secret response" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SettingsScreen />);

    fireEvent.change(screen.getByLabelText("Тестовая модель AI Tunnel"), { target: { value: "claude-sonnet-4-6" } });
    fireEvent.click(screen.getByRole("button", { name: "Проверить подключение" }));

    expect(await screen.findByText("Подключение работает")).toBeInTheDocument();
    expect(screen.queryByText(/secret response/)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
