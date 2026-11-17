import { QueryInterface, QueryTypes } from "sequelize";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { encryptSecret, isEncrypted } = require("../../helpers/secretBox");

/**
 * Criptografa as chaves de IA já salvas em texto puro:
 * - Prompts.apiKey (prompts das conexões);
 * - Tickets.dataWebhook.settings.apiKey (cópia feita pelo nó de IA do construtor de fluxos).
 * Usa SECRETS_KEY (ou o derivado do JWT_SECRET) do .env, o mesmo que o servidor usa para abrir.
 * Idempotente: valores já criptografados ficam como estão.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const prompts = (await queryInterface.sequelize.query(
      `SELECT id, "apiKey" FROM "Prompts" WHERE "apiKey" IS NOT NULL AND "apiKey" <> ''`,
      { type: QueryTypes.SELECT }
    )) as { id: number; apiKey: string }[];
    for (const row of prompts) {
      if (isEncrypted(row.apiKey)) continue;
      await queryInterface.sequelize.query(`UPDATE "Prompts" SET "apiKey" = :key WHERE id = :id`, {
        replacements: { key: encryptSecret(row.apiKey), id: row.id }
      });
    }

    const tickets = (await queryInterface.sequelize.query(
      `SELECT id, "dataWebhook" FROM "Tickets" WHERE "dataWebhook"::jsonb -> 'settings' ? 'apiKey'`,
      { type: QueryTypes.SELECT }
    )) as { id: number; dataWebhook: any }[];
    for (const row of tickets) {
      const data = typeof row.dataWebhook === "string" ? JSON.parse(row.dataWebhook) : row.dataWebhook;
      const key = data?.settings?.apiKey;
      if (!key || isEncrypted(key)) continue;
      data.settings.apiKey = encryptSecret(key);
      await queryInterface.sequelize.query(`UPDATE "Tickets" SET "dataWebhook" = :data WHERE id = :id`, {
        replacements: { data: JSON.stringify(data), id: row.id }
      });
    }
  },

  // Não volta para texto puro: o servidor continua lendo as chaves criptografadas.
  down: async () => undefined
};
