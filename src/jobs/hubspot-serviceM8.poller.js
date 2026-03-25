import cron from "node-cron";
import { logger } from "../index.js";
import {
  // --------------------------[Hubspot -> ServiceM8]--------------------------
  //  Deal -> Job
  syncHubspotDealToServiceM8Job,
  // Contact -> Client
  syncHubspotContactToServiceM8Client,
  // Company -> Client
  syncHubspotCompanyToServiceM8Client,
} from "../services/hubspot.service.js";

let isRunning = false; // Flag to prevent overlapping executions
// const schedulerFrequesncy = "0 */2 * * * *"; // Every 2 min (for testing, adjust as needed for production)
const schedulerFrequesncy = "0 * * * *"; // Every Hour at min 0 (for testing, adjust as needed for production)

logger.info(
  `Scheduler Initialized fro Hubspot-ServiceM8 successfully Sync-Frequency ${schedulerFrequesncy}`
);
cron.schedule(schedulerFrequesncy, async () => {
  if (isRunning) {
    logger.info(`Hubspot-ServiceM8 is already running...`);
    return;
  }
  // Simultaneously handle both ServiceM8 and Hubspot tasks
  logger.info("Polling Hubspot-ServiceM8 started...");
  // await Promise.allSettled([
  await syncHubspotDealToServiceM8Job();
  await syncHubspotContactToServiceM8Client();
  await syncHubspotCompanyToServiceM8Client();
  // ]);
  try {
  } catch (error) {
    logger.error("❌ Critical startup failure:", {
      httpStatus: error?.status,
      response: error.response?.data,
      message: error.message,
      stack: error.stack,
    });
  } finally {
    isRunning = false; // Reset the flag after execution
  }
});
