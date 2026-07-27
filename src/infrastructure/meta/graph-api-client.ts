import { env } from "../../config/env";

const GRAPH_API_BASE = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`;

export class MetaGraphApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "MetaGraphApiError";
  }
}

interface SendTemplateResult {
  externalMessageId: string;
  rawResponse: unknown;
}

export interface TemplateComponentParameter {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface TemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: string;
  index?: string;
  parameters: TemplateComponentParameter[];
}

/// Templates MARKETING passam pela API "Marketing Messages Lite" (exige adesão
/// prévia no Business Manager); UTILITY e AUTHENTICATION vão pelo endpoint padrão
/// /messages — mesma distinção que o app antigo já fazia.
export async function sendTemplateMessage(
  phoneNumberId: string,
  category: string,
  templateName: string,
  language: string,
  toWaId: string,
  components: TemplateComponent[],
): Promise<SendTemplateResult> {
  const endpoint = category === "MARKETING" ? "marketing_messages" : "messages";
  const url = `${GRAPH_API_BASE}/${phoneNumberId}/${endpoint}`;

  const body = {
    messaging_product: "whatsapp",
    to: toWaId,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseBody = (await response.json().catch(() => null)) as { messages?: { id: string }[]; error?: unknown } | null;

  if (!response.ok) {
    throw new MetaGraphApiError(`Meta Graph API respondeu ${response.status}`, response.status, responseBody);
  }

  const externalMessageId = responseBody?.messages?.[0]?.id;
  if (!externalMessageId) {
    throw new MetaGraphApiError("Resposta da Meta sem id de mensagem.", response.status, responseBody);
  }

  return { externalMessageId, rawResponse: responseBody };
}
