import { Router } from "express";
import type { Channel as AmqpChannel } from "amqplib";
import { z } from "zod";
import { assertQueueWithDlq } from "../../infrastructure/queue/rabbitmq/connection";
import { QUEUE_CAMPAIGN_MESSAGE_SEND } from "../../infrastructure/queue/rabbitmq/queues";
import { requireInternalApiKey } from "./middlewares/internal-auth";

const contactSchema = z.object({
  phone: z.string().min(8),
  email: z.string().optional(),
  name: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  parametersHeader: z.array(z.object({ type: z.string(), text: z.string() })).optional(),
  parametersBody: z.array(z.object({ type: z.string(), text: z.string() })).optional(),
  parametersButton: z.array(z.object({ type: z.string(), text: z.string() })).optional(),
  buttonSubType: z.string().optional(),
});

const campaignSendSchema = z.object({
  campaignId: z.string().min(1),
  organizationId: z.string().min(1),
  whatsappChannelId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
  serviceIslandId: z.string().min(1),
  agentId: z.string().min(1),
  agentName: z.string().min(1),
  templateName: z.string().min(1),
  language: z.string().min(1),
  category: z.string().min(1),
  templateHeaderText: z.string().optional(),
  templateBodyText: z.string().optional(),
  contacts: z.array(contactSchema).min(1),
  routeToQueueId: z.string().min(1).optional(),
  routeToUserId: z.string().min(1).optional(),
  skipTransferMessage: z.boolean().optional(),
});

export function buildCampaignRouter(channel: AmqpChannel): Router {
  const router = Router();

  router.post("/campaign/send", requireInternalApiKey, async (req, res) => {
    const parsed = campaignSendSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, result: null, message: "Dados inválidos.", errors: parsed.error.flatten() });
      return;
    }

    await assertQueueWithDlq(channel, QUEUE_CAMPAIGN_MESSAGE_SEND);
    channel.sendToQueue(QUEUE_CAMPAIGN_MESSAGE_SEND, Buffer.from(JSON.stringify(parsed.data)), { persistent: true });

    res.status(202).json({ success: true, result: { campaignId: parsed.data.campaignId }, message: "Campanha adicionada à fila de disparo." });
  });

  return router;
}
