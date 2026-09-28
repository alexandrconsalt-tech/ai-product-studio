export const AI_TUNNEL_IMAGE_MODELS_URL = "https://api.aitunnel.ru/public/aitunnel/models/images";
export const AI_TUNNEL_CHAT_MODELS_URL = "https://api.aitunnel.ru/public/aitunnel/models/chat";

export type AiTunnelCatalogModel = {
  id: string;
  provider: string | null;
  description: string | null;
};

export type AiTunnelModelCatalog = {
  imageModels: AiTunnelCatalogModel[];
  visionModels: AiTunnelCatalogModel[];
};

type CatalogEntry = {
  provider?: unknown;
  description?: unknown;
  supports_edit?: unknown;
  max_input_references?: unknown;
  modalities?: { input?: unknown };
};

function entries(payload: unknown): Array<[string, CatalogEntry]> {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const record = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, CatalogEntry>;
  return Object.entries(record).filter(([, value]) => value && typeof value === "object");
}

function model(id: string, value: CatalogEntry): AiTunnelCatalogModel {
  return {
    id,
    provider: typeof value.provider === "string" ? value.provider : null,
    description: typeof value.description === "string" ? value.description : null,
  };
}

export async function loadAiTunnelModelCatalog(): Promise<AiTunnelModelCatalog> {
  const [imagesResponse, chatResponse] = await Promise.all([fetch(AI_TUNNEL_IMAGE_MODELS_URL), fetch(AI_TUNNEL_CHAT_MODELS_URL)]);
  if (!imagesResponse.ok || !chatResponse.ok) throw new Error("Не удалось загрузить каталог моделей AI Tunnel.");
  const [imagesPayload, chatPayload] = await Promise.all([imagesResponse.json(), chatResponse.json()]);
  const imageModels = entries(imagesPayload)
    .filter(([, value]) => value.supports_edit === true && typeof value.max_input_references === "number" && value.max_input_references >= 2)
    .map(([id, value]) => model(id, value));
  const visionModels = entries(chatPayload)
    .filter(([, value]) => Array.isArray(value.modalities?.input) && value.modalities.input.includes("image"))
    .map(([id, value]) => model(id, value));
  return {
    imageModels: imageModels.sort((a, b) => a.id.localeCompare(b.id)),
    visionModels: visionModels.sort((a, b) => a.id.localeCompare(b.id)),
  };
}
