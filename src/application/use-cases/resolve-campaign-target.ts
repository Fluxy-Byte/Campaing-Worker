import { prisma } from "../../infrastructure/database/prisma/client";
import type { CampaignContactInput } from "../../domain/contracts/campaign-send-payload";

/// Encontra o Target pelo telefone (waId) dentro do canal/organização da campanha,
/// ou cria um novo — contato de campanha pode nunca ter trocado mensagem via
/// WhatsApp antes. Se já existir, atualiza nome/email só se vieram preenchidos no
/// CSV/disparo manual (nunca apaga o que já estava salvo).
export async function resolveCampaignTarget(input: {
  organizationId: string;
  whatsappChannelId: string;
  contact: CampaignContactInput;
}) {
  const waId = input.contact.phone;

  const existing = await prisma.target.findUnique({
    where: {
      organizationId_whatsappChannelId_waId: {
        organizationId: input.organizationId,
        whatsappChannelId: input.whatsappChannelId,
        waId,
      },
    },
  });

  if (!existing) {
    return prisma.target.create({
      data: {
        organizationId: input.organizationId,
        whatsappChannelId: input.whatsappChannelId,
        waId,
        name: input.contact.name,
        email: input.contact.email,
      },
    });
  }

  if (input.contact.name || input.contact.email) {
    return prisma.target.update({
      where: { id: existing.id },
      data: {
        name: input.contact.name ?? existing.name,
        email: input.contact.email ?? existing.email,
      },
    });
  }

  return existing;
}
