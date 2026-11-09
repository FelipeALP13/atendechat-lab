/**
 * Cria uma empresa e um administrador para rodar o sistema na sua máquina.
 *
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npx ts-node src/scripts/seed-demo.ts
 *
 * Não roda com NODE_ENV=production. A senha vem do ambiente de propósito: não há senha padrão
 * embutida, para esta conta não virar uma porta aberta se o script escapar para um servidor.
 */
import { hashSync } from "bcryptjs";
import { QueryTypes } from "sequelize";
import sequelize from "../database";

const one = async <T>(sql: string, bind: Record<string, unknown> = {}): Promise<T | undefined> =>
  (await sequelize.query<T>(sql, { type: QueryTypes.SELECT, bind }))[0];

(async () => {
  if (process.env.NODE_ENV === "production") {
    console.error("Este script é para desenvolvimento e não roda com NODE_ENV=production.");
    process.exit(1);
  }
  const email = String(process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.SEED_ADMIN_PASSWORD || "");
  const companyName = String(process.env.SEED_COMPANY_NAME || "Empresa de demonstração");
  if (!email || password.length < 8) {
    console.error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD (mínimo 8 caracteres).");
    process.exit(1);
  }

  const existing = await one<{ id: number }>(`SELECT id FROM "Users" WHERE email = $email`, { email });
  if (existing) {
    console.log(`Usuário ${email} já existe (id ${existing.id}). Nada a fazer.`);
    await sequelize.close();
    return;
  }

  let plan = await one<{ id: number }>(`SELECT id FROM "Plans" ORDER BY id LIMIT 1`);
  if (!plan) {
    plan = await one<{ id: number }>(
      `INSERT INTO "Plans" (name, users, connections, queues, amount, "useWhatsapp", "useFacebook", "useInstagram",
        "useCampaigns", "useSchedules", "useInternalChat", "useExternalApi", "useKanban", "useOpenAi", "useIntegrations",
        "createdAt", "updatedAt")
       VALUES ('Local', 10, 10, 10, 0, true, true, true, true, true, true, true, true, true, true, now(), now())
       RETURNING id`
    );
  }

  const company = await one<{ id: number }>(
    `INSERT INTO "Companies" (name, "planId", status, "dueDate", recurrence, "createdAt", "updatedAt")
     VALUES ($name, $planId, true, now() + interval '365 days', 'MENSAL', now(), now()) RETURNING id`,
    { name: companyName, planId: plan.id }
  );

  // CompaniesSettings tem várias colunas obrigatórias sem padrão no banco.
  const flags = [
    ["hoursCloseTicketsAuto", "48"],
    ["chatBotType", "text"],
    ["acceptCallWhatsapp", "enabled"],
    ["userRandom", "disabled"],
    ["sendGreetingMessageOneQueues", "disabled"],
    ["sendSignMessage", "enabled"],
    ["sendFarewellWaitingTicket", "disabled"],
    ["userRating", "disabled"],
    ["sendGreetingAccepted", "disabled"],
    ["CheckMsgIsGroup", "enabled"],
    ["sendQueuePosition", "disabled"],
    ["scheduleType", "disabled"],
    ["acceptAudioMessageContact", "enabled"],
    ["enableLGPD", "disabled"],
    ["sendMsgTransfTicket", "disabled"],
    ["requiredTag", "disabled"],
    ["lgpdDeleteMessage", "disabled"],
    ["lgpdHideNumber", "disabled"],
    ["lgpdConsent", "disabled"]
  ];
  await sequelize.query(
    `INSERT INTO "CompaniesSettings" ("companyId", ${flags.map(f => `"${f[0]}"`).join(", ")}, "createdAt", "updatedAt")
     VALUES ($companyId, ${flags.map((_, i) => `$f${i}`).join(", ")}, now(), now())`,
    { bind: { companyId: company.id, ...Object.fromEntries(flags.map((f, i) => [`f${i}`, f[1]])) } }
  );

  await sequelize.query(
    `INSERT INTO "Users" (name, email, "passwordHash", profile, "companyId", super, "tokenVersion", "createdAt", "updatedAt")
     VALUES ($name, $email, $hash, 'admin', $companyId, false, 0, now(), now())`,
    { bind: { name: "Administrador", email, hash: hashSync(password, 8), companyId: company.id } }
  );

  await sequelize.query(
    `INSERT INTO "Queues" (name, color, "greetingMessage", "companyId", "orderQueue", "createdAt", "updatedAt")
     VALUES ('Suporte N2', '#3943ce', 'Olá! Em que posso ajudar?', $companyId, 1, now(), now())`,
    { bind: { companyId: company.id } }
  );

  console.log(`Empresa "${companyName}" (id ${company.id}) e administrador ${email} criados.`);
  console.log("A fila Suporte N2 foi criada para o Agente N1 transferir quando não souber.");
  await sequelize.close();
})();
