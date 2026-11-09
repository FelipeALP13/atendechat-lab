import { QueryInterface } from "sequelize";

/**
 * Agente N1: base de conhecimento (páginas e trechos com busca de texto), lacunas e propostas,
 * respostas aprovadas, auditoria, consumo e configurações. Tudo separado por empresa (companyId).
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const sql = [
      `CREATE TABLE IF NOT EXISTS "N1Pages" (
        "companyId" INTEGER NOT NULL REFERENCES "Companies"(id) ON DELETE CASCADE,
        path TEXT NOT NULL, title TEXT NOT NULL, hash TEXT NOT NULL, body TEXT NOT NULL, "fetchedAt" BIGINT NOT NULL,
        PRIMARY KEY ("companyId", path))`,
      `CREATE TABLE IF NOT EXISTS "N1Chunks" (
        id SERIAL PRIMARY KEY,
        "companyId" INTEGER NOT NULL REFERENCES "Companies"(id) ON DELETE CASCADE,
        kind TEXT NOT NULL, path TEXT NOT NULL, heading TEXT NOT NULL, text TEXT NOT NULL, stems TEXT NOT NULL,
        ref TEXT, active BOOLEAN NOT NULL DEFAULT TRUE,
        tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', stems)) STORED)`,
      `CREATE INDEX IF NOT EXISTS "N1Chunks_tsv" ON "N1Chunks" USING GIN (tsv)`,
      `CREATE INDEX IF NOT EXISTS "N1Chunks_company_path" ON "N1Chunks" ("companyId", path)`,
      `CREATE TABLE IF NOT EXISTS "N1Proposals" (
        id SERIAL PRIMARY KEY,
        "companyId" INTEGER NOT NULL REFERENCES "Companies"(id) ON DELETE CASCADE,
        question TEXT NOT NULL, times INTEGER NOT NULL DEFAULT 1, "answeredBy" TEXT, answer TEXT, "suggestedPage" TEXT,
        status TEXT NOT NULL DEFAULT 'pending', "createdAt" BIGINT NOT NULL, "lastAt" BIGINT, origins TEXT)`,
      `CREATE INDEX IF NOT EXISTS "N1Proposals_company_status" ON "N1Proposals" ("companyId", status)`,
      `CREATE TABLE IF NOT EXISTS "N1Approved" (
        id SERIAL PRIMARY KEY,
        "companyId" INTEGER NOT NULL REFERENCES "Companies"(id) ON DELETE CASCADE,
        "proposalId" INTEGER, question TEXT, body TEXT, "approvedBy" TEXT, "approvedAt" BIGINT,
        "basedOnPage" TEXT, "basedOnHash" TEXT, status TEXT NOT NULL DEFAULT 'active')`,
      `CREATE TABLE IF NOT EXISTS "N1Audit" (
        id SERIAL PRIMARY KEY,
        "companyId" INTEGER NOT NULL REFERENCES "Companies"(id) ON DELETE CASCADE,
        at BIGINT NOT NULL, conversation TEXT, question TEXT NOT NULL, decision TEXT NOT NULL, reason TEXT,
        confidence INTEGER, sources TEXT, cost DOUBLE PRECISION NOT NULL DEFAULT 0)`,
      `CREATE INDEX IF NOT EXISTS "N1Audit_company_at" ON "N1Audit" ("companyId", at)`,
      `CREATE TABLE IF NOT EXISTS "N1Usage" (
        "companyId" INTEGER NOT NULL REFERENCES "Companies"(id) ON DELETE CASCADE,
        month TEXT NOT NULL, cost DOUBLE PRECISION NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY ("companyId", month))`,
      `CREATE TABLE IF NOT EXISTS "N1Settings" (
        "companyId" INTEGER NOT NULL REFERENCES "Companies"(id) ON DELETE CASCADE,
        key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY ("companyId", key))`,
      `ALTER TABLE "Whatsapps" ADD COLUMN IF NOT EXISTS "n1Enabled" BOOLEAN NOT NULL DEFAULT FALSE`
    ];
    for (const s of sql) await queryInterface.sequelize.query(s);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`ALTER TABLE "Whatsapps" DROP COLUMN IF EXISTS "n1Enabled"`);
    for (const t of ["N1Settings", "N1Usage", "N1Audit", "N1Approved", "N1Proposals", "N1Chunks", "N1Pages"]) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
};
