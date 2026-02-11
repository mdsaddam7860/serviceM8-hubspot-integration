import dotenv from "dotenv";
import path from "path";
dotenv.config({
  path: path.join(process.cwd(), ".env"),
});
import { app } from "./src/app.js";
import { logger } from "./src/index.js";
import { getHubspotClient } from "./src/configs/hubspot.config.js";

// Start the server, For CI/CD deployments remove deploy.yml from .gitignore
// npm i express axios node-cron winston winston-daily-rotate-file dotenv @mohammadsaddam-dev/hubspot-toolkit

const PORT = process.env.PORT || 5000;

function serverInit() {
  try {
    // Server is up and running

    app.listen(PORT, () => {
      logger.info(`Server running on PORT:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });

    init(); // Initialize other services and forget about them
  } catch (error) {
    logger.error("❌ Critical startup failure:", error);
  }
}

serverInit();

async function init() {
  try {
    // Initialize Hubspot Client
    try {
      const client = getHubspotClient();
      // logger.info(
      //   `✅ HubSpot client initialized successfully : ${JSON.stringify(
      //     client,
      //     null,
      //     2
      //   )}`
      // );
      logger.info(`✅ HubSpot client initialized successfully`);
    } catch (error) {
      logger.error("❌ HubSpot client failed to initialize:", error);
    }
  } catch (error) {
    logger.error("❌ Critical startup failure:", error);
  }
}
