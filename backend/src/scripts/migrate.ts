/**
 * Aplica as migrations pendentes e anota o que já foi aplicado em "SequelizeMeta".
 *
 * O sequelize-cli só enxerga migrations em .js; as deste projeto são .ts, então quem roda é este
 * script. Em desenvolvimento use ts-node; depois do build (`npm run build`), os arquivos em dist
 * já são .js e o script funciona do mesmo jeito.
 *
 *   npx ts-node src/scripts/migrate.ts          aplica o que falta
 *   npx ts-node src/scripts/migrate.ts --status  só lista, não altera nada
 */
import fs from "fs";
import path from "path";
import { QueryTypes, Sequelize } from "sequelize";
import sequelize from "../database";

const TABLE = "SequelizeMeta";

const migrationFiles = (): { name: string; file: string }[] => {
  const dir = path.join(__dirname, "..", "database", "migrations");
  const ext = path.extname(__filename); // .ts em desenvolvimento, .js depois do build
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith(ext) && !f.endsWith(`.d${ext}`))
    .sort()
    .map(f => ({ name: path.basename(f, ext), file: path.join(dir, f) }));
};

const applied = async (): Promise<Set<string>> => {
  await sequelize.query(`CREATE TABLE IF NOT EXISTS "${TABLE}" (name VARCHAR(255) NOT NULL PRIMARY KEY)`);
  const rows = await sequelize.query<{ name: string }>(`SELECT name FROM "${TABLE}"`, { type: QueryTypes.SELECT });
  // Guarda sem extensão para a mesma migration contar igual em .ts e em .js.
  return new Set(rows.map(r => r.name.replace(/\.(ts|js)$/, "")));
};

(async () => {
  const statusOnly = process.argv.indexOf("--status") >= 0;
  const done = await applied();
  const all = migrationFiles();
  const pending = all.filter(m => !done.has(m.name));

  if (statusOnly) {
    console.log(`${all.length} migrations, ${done.size} aplicadas, ${pending.length} pendentes`);
    pending.forEach(m => console.log(`  pendente: ${m.name}`));
    await sequelize.close();
    return;
  }

  if (!pending.length) {
    console.log("Banco já está em dia: nenhuma migration pendente.");
    await sequelize.close();
    return;
  }

  const qi = sequelize.getQueryInterface();
  for (const m of pending) {
    const mod = require(m.file);
    const up = mod.up || (mod.default && mod.default.up);
    if (!up) {
      console.log(`  ignorada (sem up): ${m.name}`);
      continue;
    }
    try {
      await up(qi, Sequelize);
      await sequelize.query(`INSERT INTO "${TABLE}" (name) VALUES ($name) ON CONFLICT DO NOTHING`, { bind: { name: m.name } });
      console.log(`  aplicada: ${m.name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Banco que já tinha a estrutura antes deste controle: anota e segue.
      if (/already exists|já existe|duplicate|duplicata/i.test(msg)) {
        await sequelize.query(`INSERT INTO "${TABLE}" (name) VALUES ($name) ON CONFLICT DO NOTHING`, { bind: { name: m.name } });
        console.log(`  já estava no banco: ${m.name}`);
        continue;
      }
      console.error(`\nFalhou em ${m.name}: ${msg}`);
      console.error("Nada depois dela foi aplicado. Corrija e rode de novo.");
      await sequelize.close();
      process.exit(1);
    }
  }
  console.log("Migrations em dia.");
  await sequelize.close();
})();
