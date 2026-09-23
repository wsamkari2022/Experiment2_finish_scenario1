/**
 * PM2 process definition for Experiment 2 (site + API + MongoDB connection).
 *
 * Mirrors Experiment 1's unified-backend/ecosystem.config.cjs: one named app on
 * port 4000 with autorestart, so it keeps running after SSH disconnects.
 *
 * MONGO_URL and MONGO_DB are NOT written here - they hold the database password.
 * build-and-run.sh reads them from the server's .env file and exports them
 * before calling `pm2 start`, and this file passes them through.
 *
 * All paths come from __dirname - nothing is tied to one machine.
 */

const path = require("path");

if (!process.env.MONGO_URL || !process.env.MONGO_DB) {
  throw new Error(
    "MONGO_URL / MONGO_DB are not set. Start Experiment 2 with ./build-and-run.sh, " +
      "which loads them from .env."
  );
}

module.exports = {
  apps: [
    {
      name: "experiment2-4000",
      script: path.join(__dirname, "server", "index.js"),
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: "4000",
        HOST: "0.0.0.0",
        MONGO_URL: process.env.MONGO_URL,
        MONGO_DB: process.env.MONGO_DB,
      },
      time: true,
      merge_logs: true,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
      out_file: path.join(__dirname, "logs", "server.log"),
      error_file: path.join(__dirname, "logs", "server-error.log"),
    },
  ],
};
