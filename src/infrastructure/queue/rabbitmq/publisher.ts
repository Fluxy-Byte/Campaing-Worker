import type { Channel } from "amqplib";
import { assertQueueWithDlq } from "./connection";
import { QUEUE_DESK_TICKET_CREATE } from "./queues";

interface DeskTicketCreatePayload {
  target: { id: string; waId: string | null; name: string | null; metadata: unknown };
  whatsappChannel: { id: string; phoneNumberId: string; wabaId: string; serviceIslandId: string };
  messagingSession: { id: string; startedAt: Date | string };
  agent: { id: string; name: string };
  queueId: string;
  /// Se preenchido, o Desk-Worker cria o ticket já IN_PROGRESS + atribuído a
  /// este atendente, em vez de WAITING na fila (ver find-or-create-open-ticket.ts).
  assignedUserId?: string;
  /// Repassado direto pro Desk-Worker — ver find-or-create-open-ticket.ts.
  skipTransferMessage?: boolean;
}

/// Publica na mesma fila que o AI-Worker já usa pra handoff de atendimento
/// humano — o Desk-Worker cria o Ticket e marca o Target como HUMAN
/// atomicamente (findOrCreateOpenTicket), sem precisar de nenhuma lógica
/// nova aqui além de montar o payload certo.
export async function publishDeskTicketCreate(channel: Channel, payload: DeskTicketCreatePayload): Promise<void> {
  await assertQueueWithDlq(channel, QUEUE_DESK_TICKET_CREATE);
  channel.sendToQueue(QUEUE_DESK_TICKET_CREATE, Buffer.from(JSON.stringify(payload)), { persistent: true });
}
