export interface CampaignContactInput {
  phone: string;
  email?: string;
  name?: string;
  // Qualquer campo do contato que não seja telefone/nome/email — mergeado em
  // Target.metadata (nunca apaga o que já existia, ver resolveCampaignTarget).
  metadata?: Record<string, string>;
  // Opcionais: templates sem variável no header/body (comum em UTILITY/AUTHENTICATION
  // simples) não devem mandar esse componente pra Meta — ver montagem em quem consome.
  parametersHeader?: { type: string; text: string }[];
  parametersBody?: { type: string; text: string }[];
  // Parâmetro do componente de botão — usado por templates AUTHENTICATION com botão
  // "copy_code"/"url".
  parametersButton?: { type: string; text: string }[];
  buttonSubType?: string;
}

/// Corpo esperado em POST /campaign/send — a Campaign já foi criada de forma
/// síncrona pelo Agent-Api antes de chamar este endpoint; aqui só se enfileira o envio.
export interface CampaignSendPayload {
  campaignId: string;
  organizationId: string;
  whatsappChannelId: string;
  phoneNumberId: string;
  wabaId: string;
  serviceIslandId: string;
  agentId: string;
  agentName: string;
  templateName: string;
  language: string;
  category: string;
  // Texto cru do componente HEADER/BODY do template (com {{n}}) — usado só para
  // gravar no histórico de conversa a mensagem já com as variáveis substituídas
  // (não é reenviado à Meta, que recebe os parâmetros separadamente).
  templateHeaderText?: string;
  templateBodyText?: string;
  contacts: CampaignContactInput[];
  // Se preenchido, cada contato enviado com sucesso vira um Ticket nesta fila
  // (publica desk.ticket.create, mesmo mecanismo do handoff de IA) e o Target
  // correspondente vira HUMAN em vez de continuar na IA.
  routeToQueueId?: string;
  // Só faz sentido junto de routeToQueueId — atendente assume o ticket direto
  // (IN_PROGRESS) em vez de cair WAITING na fila.
  routeToUserId?: string;
  // Usado pelo disparo ativo do Desk — suprime a transferMessage genérica do
  // agente (o contato já recebeu o template disparado pelo próprio atendente).
  skipTransferMessage?: boolean;
}
