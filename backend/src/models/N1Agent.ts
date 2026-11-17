import {
  AllowNull,
  AutoIncrement,
  BeforeSave,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";
import Queue from "./Queue";
import { encryptSecret, maskSecret } from "../helpers/secretBox";

/** Agente N1 (Claude) de uma empresa: responde o primeiro atendimento e passa para a equipe (N2). */
@Table({ tableName: "N1Agents" })
class N1Agent extends Model<N1Agent> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Default("Assistente")
  @Column
  name: string;

  @Default(false)
  @Column
  enabled: boolean;

  /** Conexões (WhatsApp normal ou oficial) onde o N1 atende. */
  @Default([])
  @Column(DataType.JSON)
  whatsappIds: number[];

  /** Fila que recebe o atendimento quando o N1 transfere (N2). */
  @ForeignKey(() => Queue)
  @AllowNull
  @Column
  handoffQueueId: number | null;

  @BelongsTo(() => Queue)
  handoffQueue: Queue;

  /** O que a empresa quer que o N1 saiba e como deve falar (vai junto das regras fixas). */
  @Default("")
  @Column(DataType.TEXT)
  instructions: string;

  /** Chave da API da Anthropic (sempre criptografada no banco). */
  @AllowNull
  @Column(DataType.TEXT)
  apiKey: string | null;

  @Default("claude-opus-5-5")
  @Column
  model: string;

  @Default("medium")
  @Column
  effort: string;

  /** Mensagens do cliente que o N1 responde antes de passar para a equipe de qualquer jeito. */
  @Default(8)
  @Column
  maxTurns: number;

  /** Endereço do Portal da Equipe (Base de conhecimento e chamados). */
  @AllowNull
  @Column
  portalUrl: string | null;

  /** Chave de integração criada no Portal (sempre criptografada no banco). */
  @AllowNull
  @Column(DataType.TEXT)
  portalKey: string | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BeforeSave
  static encryptKeys(instance: N1Agent): void {
    if (instance.changed("apiKey") && instance.apiKey) instance.apiKey = encryptSecret(instance.apiKey) as string;
    if (instance.changed("portalKey") && instance.portalKey) instance.portalKey = encryptSecret(instance.portalKey) as string;
  }

  /** Para a tela: chaves mascaradas. Para usar, decryptSecret(agent.apiKey). */
  toJSON(): object {
    const values = super.toJSON() as Record<string, unknown>;
    values.apiKey = maskSecret(values.apiKey as string);
    values.portalKey = maskSecret(values.portalKey as string);
    return values;
  }
}

export default N1Agent;
