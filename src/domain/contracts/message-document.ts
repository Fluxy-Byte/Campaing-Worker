import type { ObjectId } from "mongodb";

/// Contrato da collection `messages` no Mongo (banco compartilhado). Espelho exato
/// de Agent-Api/Outbound-Worker/src/domain/contracts/message-document.ts — mudanças
/// precisam ser replicadas manualmente nos demais.
export interface MessageDocument {
  _id?: ObjectId;
  organizationId: string;
  targetId: string;
  whatsappChannelId: string;
  messagingSessionId: string;
  direction: "INBOUND" | "OUTBOUND";
  senderType: "CUSTOMER" | "AGENT_AI" | "ATTENDANT" | "SYSTEM" | "CAMPAIGN";
  messageType: "TEXT" | "AUDIO" | "IMAGE" | "DOCUMENT" | "STICKER";
  externalMessageId?: string;
  text?: string;
  mediaUrl?: string;
  mediaCaption?: string;
  waStatus?: "sent" | "delivered" | "read" | "failed";
  // Só preenchidos quando senderType === "CAMPAIGN" — identifica de qual campanha e
  // template veio o disparo, pra UI do histórico de conversa mostrar o rótulo certo.
  campaignId?: string;
  templateName?: string;
  createdAt: Date;
}

export const MESSAGES_COLLECTION = "messages";
