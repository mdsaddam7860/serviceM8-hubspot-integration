import cron from "node-cron";
import { logger } from "../index.js";
import {
  // ✅ Fetch deal from hubspot and sync to serviceM8 as Job, Job will be only one way sync from HS-SM8
  syncHubspotDealToServiceM8Job,
  // ✅ Fetch Contact from hubspot and sync to serviceM8 as Client
  syncHubspotContactToServiceM8Client,
  // ✅ Fetch company from hubspot and sync to serviceM8 as company(client)
  syncHubspotCompanyToServiceM8Client,
} from "../services/hubspot.service.js";

let isRunning = false; // Flag to prevent overlapping executions
logger.info(`Scheduler Initialized fro Hubspot-ServiceM8 successfully...`);
const schedulerFrequesncy = "0 */30 * * * *"; // Every 30 min (for testing, adjust as needed for production)
cron.schedule(schedulerFrequesncy, async () => {
  if (isRunning) {
    logger.info(`Hubspot-ServiceM8 is already running...`);
    return;
  }
  // Simultaneously handle both ServiceM8 and Hubspot tasks
  logger.info("Polling Hubspot-ServiceM8 started...");
  await Promise.allSettled([
    syncHubspotDealToServiceM8Job,
    syncHubspotContactToServiceM8Client,
    syncHubspotCompanyToServiceM8Client,
  ]);
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
