import { QueryInterface } from "sequelize";

/**
 * Módulo Site e chat: configuração (rascunho e publicada), eventos do funil e contatos deixados
 * no chat público. Tudo separado por empresa (companyId). O token identifica a empresa nas
 * rotas públicas, sem expor o id interno.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const sql = [
      `CREATE TABLE IF NOT EXISTS "SiteConfigs" (
        id SERIAL PRIMARY KEY,
        "companyId" INTEGER NOT NULL UNIQUE REFERENCES "Companies"(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        draft TEXT, live TEXT, "publishedAt" BIGINT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS "SiteEvents" (
        id SERIAL PRIMARY KEY,
        "companyId" INTEGER NOT NULL REFERENCES "Companies"(id) ON DELETE CASCADE,
        at BIGINT NOT NULL, session TEXT NOT NULL, event TEXT NOT NULL, detail TEXT)`,
      `CREATE INDEX IF NOT EXISTS "SiteEvents_company_event_at" ON "SiteEvents" ("companyId", event, at)`,
      `CREATE TABLE IF NOT EXISTS "SiteLeads" (
        id SERIAL PRIMARY KEY,
        "companyId" INTEGER NOT NULL REFERENCES "Companies"(id) ON DELETE CASCADE,
        at BIGINT NOT NULL, session TEXT, name TEXT NOT NULL, contact TEXT NOT NULL, question TEXT,
        status TEXT NOT NULL DEFAULT 'new', "ticketId" INTEGER)`,
      `CREATE INDEX IF NOT EXISTS "SiteLeads_company_status" ON "SiteLeads" ("companyId", status)`
    ];
    for (const s of sql) await queryInterface.sequelize.query(s);
  },

  down: async (queryInterface: QueryInterface) => {
    for (const t of ["SiteLeads", "SiteEvents", "SiteConfigs"]) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
};
