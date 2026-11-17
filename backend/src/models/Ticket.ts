import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  HasMany,
  AutoIncrement,
  Default,
  BeforeCreate,
  BeforeUpdate,
  BelongsToMany,
  AllowNull,
  DataType
} from "sequelize-typescript";
import { randomUUID } from "crypto";
import { redactAiSettings } from "../helpers/secretBox";

import Contact from "./Contact";
import Message from "./Message";
import Queue from "./Queue";
import User from "./User";
import Whatsapp from "./Whatsapp";
import Company from "./Company";
import Tag from "./Tag";
import TicketTag from "./TicketTag";
import QueueIntegrations from "./QueueIntegrations";
// Removido import de date-fns (não utilizado)

@Table
class Ticket extends Model<Ticket> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column({ defaultValue: "pending" })
  status: string;

  @Column
  unreadMessages: number;

  @Column
  lastMessage: string;

  @Default(false)
  @Column
  isGroup: boolean;

  @Column
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @Default(false)
  @Column
  isBot: boolean;

  @HasMany(() => Message)
  messages: Message[];

  @HasMany(() => TicketTag)
  ticketTags: TicketTag[];

  @BelongsToMany(() => Tag, () => TicketTag)
  tags: Tag[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  uuid: string;

  @Default("whatsapp")
  @Column
  channel: string;

  @AllowNull(false)
  @Default(0)
  @Column
  amountUsedBotQueues: number;

  @AllowNull(false)
  @Default(0)
  @Column
  amountUsedBotQueuesNPS: number;

  @BeforeCreate
  static setUUID(ticket: Ticket) {
    ticket.uuid = randomUUID();
  }

  @Default(false)
  @Column
  fromMe: boolean;

  @Default(false)
  @Column
  sendInactiveMessage: boolean;

  @Column
  lgpdSendMessageAt: Date;

  @Column
  lgpdAcceptedAt: Date;

  @Column
  imported: Date;

  @Default(false)
  @Column
  isOutOfHour: boolean;

  @Default(false)
  @Column
  useIntegration: boolean;

  @ForeignKey(() => QueueIntegrations)
  @Column
  integrationId: number;

  @BelongsTo(() => QueueIntegrations)
  queueIntegration: QueueIntegrations;

  @Column
  isActiveDemand: boolean;

  @Column
  typebotSessionId: string;

  @Default(false)
  @Column
  typebotStatus: boolean;

  @Column
  typebotSessionTime: Date;

  @Column
  flowWebhook: boolean;

  @Column
  lastFlowId: string;

  @Column
  hashFlowId: string;

  @Column
  flowStopped: string;

  @Column(DataType.JSON)
  dataWebhook: {
    variables?: Record<string, string>;
    pendingQuestion?: string;
    sgp?: {
      cpfUsuario?: string;
      senhaUsuario?: string;
      aguardandoSenha?: boolean;
      aguardandoContrato?: boolean;
      contratoSelecionado?: string;
    };
  } | null;

  @AllowNull(false)
  @Default(0)
  @Column
  maxUseInactiveTime: number;

  @Column({ type: DataType.FLOAT, allowNull: true })
  valorVenda: number | null;

  @Column({ type: DataType.STRING, allowNull: true })
  motivoNaoVenda: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  motivoFinalizacao: string | null;

  @Default(false)
  @Column
  finalizadoComVenda: boolean;

  /** Agente N1: "active" (conversando), "handed_off" (passou para a equipe) ou null (não participou). */
  @AllowNull
  @Column(DataType.STRING)
  n1Status: string | null;

  /** Quantas mensagens do cliente o N1 respondeu neste atendimento. */
  @Default(0)
  @Column
  n1Turns: number;

  /** Atendimento encerrado: se for reaberto, o N1 recomeça do zero. */
  @BeforeUpdate
  static resetN1WhenClosed(instance: Ticket): void {
    if (instance.changed("status") && instance.status === "closed") {
      instance.n1Status = null;
      instance.n1Turns = 0;
    }
  }

  /**
   * O que vai para a tela e para o socket: sem a chave da IA (dataWebhook.settings.apiKey)
   * nem a senha que o cliente digitou para o SGP. Esses dados ficam só no servidor.
   */
  toJSON(): object {
    const values = super.toJSON() as Record<string, unknown>;
    const data = values.dataWebhook as Record<string, any> | null | undefined;
    if (data && typeof data === "object") {
      let safe: Record<string, any> = redactAiSettings(data);
      if (safe.sgp && typeof safe.sgp === "object" && "senhaUsuario" in safe.sgp) {
        safe = { ...safe, sgp: { ...safe.sgp, senhaUsuario: safe.sgp.senhaUsuario ? "••••" : "" } };
      }
      values.dataWebhook = safe;
    }
    return values;
  }
}

export default Ticket;
