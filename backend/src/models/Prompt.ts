import {
  AllowNull,
  AutoIncrement,
  BeforeSave,
  BelongsTo,
  Column,
  CreatedAt,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Queue from "./Queue";
import Company from "./Company";
import { encryptSecret, maskSecret } from "../helpers/secretBox";

@Table
class Prompt extends Model<Prompt> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column
  prompt: string;

  @AllowNull(false)
  @Column
  apiKey: string;

  @Column({ defaultValue: 10 })
  maxMessages: number;

  @Column({ defaultValue: 100 })
  maxTokens: number;

  @Column({ defaultValue: 1 })
  temperature: number;

  @Column({ defaultValue: 0 })
  promptTokens: number;

  @Column({ defaultValue: 0 })
  completionTokens: number;

  @Column({ defaultValue: 0 })
  totalTokens: number;

  @AllowNull(false)
  @Column
  voice: string;

  @AllowNull(true)
  @Column
  voiceKey:string;

  @AllowNull(true)
  @Column
  voiceRegion:string;

  @AllowNull
  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  /** A chave de API é sempre gravada criptografada (vale para criar e editar). */
  @BeforeSave
  static encryptApiKey(instance: Prompt): void {
    if (instance.changed("apiKey") && instance.apiKey) {
      instance.apiKey = encryptSecret(instance.apiKey) as string;
    }
  }

  /** Para a tela: só os 4 últimos caracteres da chave. Para usar a chave, decryptSecret(prompt.apiKey). */
  toJSON(): object {
    const values = super.toJSON() as Record<string, unknown>;
    values.apiKey = maskSecret(values.apiKey as string);
    return values;
  }
}

export default Prompt;
