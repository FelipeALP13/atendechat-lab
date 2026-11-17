require("../bootstrap");


// são paulo timezone


module.exports = {
  define: {
    charset: "utf8mb4",
    collate: "utf8mb4_bin"
    // freezeTableName: true
  },
  options: { requestTimeout: 600000, encrypt: true },
  retry: {
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ],
    max: 100
  },
  // "0" é um valor válido (antes `|| 15` trocava DB_POOL_MIN=0 por 15, maior que o máximo, e o banco não conectava).
  pool: (() => {
    const read = (name: string, fallback: number) => {
      const value = parseInt(process.env[name] ?? "", 10);
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    };
    const max = Math.max(1, read("DB_POOL_MAX", 100));
    return {
      max,
      min: Math.min(read("DB_POOL_MIN", 15), max),
      acquire: read("DB_POOL_ACQUIRE", 30000),
      idle: read("DB_POOL_IDLE", 600000)
    };
  })(),
  dialect: process.env.DB_DIALECT || "postgres",
  timezone: 'America/Sao_Paulo',
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || "5432",
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  logging: false
};
