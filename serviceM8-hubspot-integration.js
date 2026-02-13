import dotenv from "dotenv";
import path from "path";
dotenv.config({
  path: path.join(process.cwd(), ".env"),
});
import { app } from "./src/app.js";
import { logger } from "./src/index.js";
import { syncContact } from "./src/services/hubspot.service.js";
import { getHubspotClient, getHSAxios } from "./src/configs/hubspot.config.js";
import { getServiceM8Client } from "./src/configs/serviceM8.config.js";
// Start the server, For CI/CD deployments remove deploy.yml from .gitignore
// npm i
import {
  syncCompaniesTask,
  syncServiceM8ClientToHubSpotAsContact,
} from "./src/services/serviceM8.service.js";
import { serviceM8Client } from "./src/configs/serviceM8.config.js";
import { processBatchDealInHubspot } from "./src/services/hubspot.service.js";

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
// syncContact();

async function init() {
  try {
    // Initialize Hubspot and serviceM8 Client
    try {
      logger.info(` ➡️  Configs initializeation started successfully...`);
      getHubspotClient();
      getHSAxios();
      getServiceM8Client();
      // logger.info(
      //   `✅ HubSpot client initialized successfully : ${JSON.stringify(
      //     hsAxios,
      //     null,
      //     2
      //   )}`
      // );
      // logger.info(`Client: ${JSON.stringify(serviceM8Client, null, 2)}`);
      logger.info(`✅  client initialized successfully`);
    } catch (error) {
      logger.error("❌ HubSpot client failed to initialize:", error);
    }
  } catch (error) {
    logger.error("❌ Critical startup failure:", error);
  }
}
