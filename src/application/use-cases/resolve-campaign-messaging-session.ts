import { prisma } from "../../infrastructure/database/prisma/client";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/// Mesma regra de janela de 24h de Inbound-Service/messaging-session-service.ts
/// (resolveOrCreateMessagingSession), mas do lado de quem INICIA o contato (a
/// campanha), não de quem recebe uma mensagem do cliente: se a sessão mais
/// recente expirou (ou nunca existiu), cria uma nova linha com
/// createdVia="CAMPAIGN_TEMPLATE" (o template aprovado reabre a janela de
/// atendimento). Se ainda está dentro da janela, só reaproveita a sessão
/// existente — nunca atualiza lastCustomerMessageAt aqui, isso é reservado para
/// atividade real do cliente.
export async function resolveCampaignMessagingSession(input: { targetId: string; whatsappChannelId: string }) {
  const latest = await prisma.messagingSession.findFirst({
    where: { targetId: input.targetId },
    orderBy: { startedAt: "desc" },
  });

  const expired = !latest || Date.now() - latest.lastCustomerMessageAt.getTime() > WINDOW_MS;

  if (expired) {
    return prisma.messagingSession.create({
      data: {
        targetId: input.targetId,
        whatsappChannelId: input.whatsappChannelId,
        createdVia: "CAMPAIGN_TEMPLATE",
        lastCustomerMessageAt: new Date(),
      },
    });
  }

  return latest;
}
