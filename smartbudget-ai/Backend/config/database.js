
const { Pool } = require("pg");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

const pool = process.env.DATABASE_URL
    ? new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: isProduction
              ? { rejectUnauthorized: false }
              : undefined,
      })
    : new Pool({
          user: process.env.DB_USER,
          host: process.env.DB_HOST,
          database: process.env.DB_NAME,
          password: process.env.DB_PASSWORD,
          port: Number(process.env.DB_PORT || 5432),
      });

pool.on("connect", () => {
    console.log("PostgreSQL client connected ✅");
});

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err.message);
});

pool.query("SELECT 1")
    .then(() => {
        console.log(
            process.env.DATABASE_URL
                ? "Supabase PostgreSQL Connected ✅"
                : "Local PostgreSQL Connected ✅"
        );
    })
    .catch((err) => {
        console.error("Database Connection Error ❌", err.message);
    });

module.exports = pool;
