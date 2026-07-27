import type { Channel, ConsumeMessage } from "amqplib";
import type { CampaignSendPayload } from "../../domain/contracts/campaign-send-payload";
import { processCampaignSend } from "../../application/use-cases/process-campaign-send";
import { assertQueueWithDlq } from "../../infrastructure/queue/rabbitmq/connection";
import { QUEUE_CAMPAIGN_MESSAGE_SEND } from "../../infrastructure/queue/rabbitmq/queues";

export async function startCampaignMessageConsumer(channel: Channel): Promise<void> {
  await assertQueueWithDlq(channel, QUEUE_CAMPAIGN_MESSAGE_SEND);
  channel.prefetch(1);

  channel.consume(QUEUE_CAMPAIGN_MESSAGE_SEND, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    try {
      const payload: CampaignSendPayload = JSON.parse(msg.content.toString());
      console.log(`[CAMPAIGN-WORKER] processando campaignId=${payload.campaignId} (${payload.contacts.length} contatos)`);
      await processCampaignSend(payload);
      console.log(`[CAMPAIGN-WORKER] campaignId=${payload.campaignId} concluída`);
      channel.ack(msg);
    } catch (error) {
      console.error("[CAMPAIGN-WORKER] falha ao processar mensagem, enviando para DLQ:", error);
      channel.nack(msg, false, false);
    }
  });
}
