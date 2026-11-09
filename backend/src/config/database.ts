require("../bootstrap");

/** parseInt(x) || padrao trata 0 como ausente; aqui 0 é um valor válido (DB_POOL_MIN=0). */
const num = (value: string | undefined, fallback: number): number => {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
};


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
  pool: {
    max: num(process.env.DB_POOL_MAX, 100),
    min: Math.min(num(process.env.DB_POOL_MIN, 15), num(process.env.DB_POOL_MAX, 100)),
    acquire: num(process.env.DB_POOL_ACQUIRE, 30000),
    idle: num(process.env.DB_POOL_IDLE, 600000)
  },
  dialect: process.env.DB_DIALECT || "postgres",
  timezone: 'America/Sao_Paulo',
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || "5432",
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  logging: false
};
