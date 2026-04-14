import "./bootstrap.js";
import app from "./src/app.js";
import { logger } from "./src/index.js";
import { getHubspotClient, getHSAxios } from "./src/configs/hubspot.config.js";
import { getServiceM8Client } from "./src/configs/serviceM8.config.js";

// ------------------------------ Node Cron Schedulers------------------------------------
import "./src/jobs/bi-direction-poller.js";

// ------------------------------- Node Server--------------------------------------------
const PORT = process.env.PORT || 5000;

function serverInitialize() {
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

serverInitialize();

// Configuration Initialization function at startup
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
      logger.info(`✅  Configs initialized successfully`);
    } catch (error) {
      logger.error("❌ HubSpot client failed to initialize:", error);
    }
  } catch (error) {
    logger.error("❌ Critical startup failure:", error);
  }
}
