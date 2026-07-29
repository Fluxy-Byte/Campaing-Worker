import { MESSAGES_COLLECTION, type MessageDocument } from "../../domain/contracts/message-document";
import type { CampaignContactInput, CampaignSendPayload } from "../../domain/contracts/campaign-send-payload";
import { getMongoDb } from "../../infrastructure/database/mongo/client";
import { prisma } from "../../infrastructure/database/prisma/client";
import { MetaGraphApiError, sendTemplateMessage, type TemplateComponent } from "../../infrastructure/meta/graph-api-client";
import { getRabbitChannel } from "../../infrastructure/queue/rabbitmq/connection";
import { publishDeskTicketCreate } from "../../infrastructure/queue/rabbitmq/publisher";
import { resolveCampaignMessagingSession } from "./resolve-campaign-messaging-session";
import { resolveCampaignTarget } from "./resolve-campaign-target";

/// Substitui {{1}}, {{2}}... pelo valor correspondente — só para deixar o
/// histórico de conversa legível (a Meta recebe os parâmetros separadamente,
/// estruturados, não este texto).
function interpolateTemplate(text: string | undefined, params: { text?: string }[] | undefined): string | undefined {
  if (!text) return undefined;
  if (!params || params.length === 0) return text;
  return text.replace(/\{\{(\d+)\}\}/g, (match, indexStr) => {
    const index = Number(indexStr) - 1;
    return params[index]?.text ?? match;
  });
}

function buildComponents(contact: CampaignContactInput): TemplateComponent[] {
  const components: TemplateComponent[] = [];

  if (contact.parametersHeader && contact.parametersHeader.length > 0) {
    components.push({ type: "header", parameters: contact.parametersHeader });
  }
  if (contact.parametersBody && contact.parametersBody.length > 0) {
    components.push({ type: "body", parameters: contact.parametersBody });
  }
  if (contact.parametersButton && contact.parametersButton.length > 0) {
    components.push({
      type: "button",
      sub_type: contact.buttonSubType ?? "url",
      index: "0",
      parameters: contact.parametersButton,
    });
  }

  return components;
}

async function processContact(payload: CampaignSendPayload, contact: CampaignContactInput): Promise<void> {
  const components = buildComponents(contact);

  let externalMessageId: string | undefined;
  let rawResponse: unknown;
  let status: "SENT" | "FAILED" = "SENT";

  try {
    const result = await sendTemplateMessage(
      payload.phoneNumberId,
      payload.category,
      payload.templateName,
      payload.language,
      contact.phone,
      components,
    );
    externalMessageId = result.externalMessageId;
    rawResponse = result.rawResponse;
  } catch (error) {
    status = "FAILED";
    rawResponse = error instanceof MetaGraphApiError ? error.body : String(error);
    console.error(`[CAMPAIGN-WORKER] falha ao enviar template para ${contact.phone}:`, error);
  }

  const target = await resolveCampaignTarget({
    organizationId: payload.organizationId,
    whatsappChannelId: payload.whatsappChannelId,
    contact,
  });

  const messagingSession = await resolveCampaignMessagingSession({
    targetId: target.id,
    whatsappChannelId: payload.whatsappChannelId,
  });

  await prisma.campaignTarget.create({
    data: {
      campaignId: payload.campaignId,
      targetId: target.id,
      status,
      response: JSON.stringify(rawResponse),
      messageId: externalMessageId,
      variables: {
        header: contact.parametersHeader ?? null,
        body: contact.parametersBody ?? null,
        button: contact.parametersButton ?? null,
      },
    },
  });

  await prisma.campaign.update({
    where: { id: payload.campaignId },
    data:
      status === "SENT"
        ? { totalSent: { increment: 1 }, totalContacts: { increment: 1 } }
        : { totalFailures: { increment: 1 }, totalContacts: { increment: 1 } },
  });

  if (status === "SENT") {
    const headerText = interpolateTemplate(payload.templateHeaderText, contact.parametersHeader);
    const bodyText = interpolateTemplate(payload.templateBodyText, contact.parametersBody);
    const text = [headerText, bodyText].filter(Boolean).join("\n\n") || payload.templateName;

    const db = await getMongoDb();
    const document: MessageDocument = {
      organizationId: payload.organizationId,
      targetId: target.id,
      whatsappChannelId: payload.whatsappChannelId,
      messagingSessionId: messagingSession.id,
      direction: "OUTBOUND",
      senderType: "CAMPAIGN",
      messageType: "TEXT",
      externalMessageId,
      text,
      campaignId: payload.campaignId,
      templateName: payload.templateName,
      createdAt: new Date(),
    };
    await db.collection<MessageDocument>(MESSAGES_COLLECTION).insertOne(document);

    if (payload.routeToQueueId) {
      const channel = await getRabbitChannel();
      await publishDeskTicketCreate(channel, {
        target: { id: target.id, waId: target.waId, name: target.name, metadata: target.metadata },
        whatsappChannel: {
          id: payload.whatsappChannelId,
          phoneNumberId: payload.phoneNumberId,
          wabaId: payload.wabaId,
          serviceIslandId: payload.serviceIslandId,
        },
        messagingSession: { id: messagingSession.id, startedAt: messagingSession.startedAt },
        agent: { id: payload.agentId, name: payload.agentName },
        queueId: payload.routeToQueueId,
        assignedUserId: payload.routeToUserId,
      });
    }
  }
}

/// Processa o lote inteiro de uma campanha — chamado 1x por mensagem consumida
/// da fila `campaign.message.send` (1 mensagem de fila = 1 campanha inteira,
/// mesmo desenho do worker antigo). Contatos são processados em sequência
/// (não em paralelo) para não estourar rate limit da Graph API.
export async function processCampaignSend(payload: CampaignSendPayload): Promise<void> {
  for (const contact of payload.contacts) {
    await processContact(payload, contact);
  }

  await prisma.campaign.update({
    where: { id: payload.campaignId },
    data: { status: "COMPLETED" },
  });
}
