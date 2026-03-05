import cron from "node-cron";
import { logger } from "../index.js";
import {
  // ✅ Fetch Client from serviceM8 and sync to Hubspot as Contact
  syncServiceM8ClientToHubSpotAsContact,
  // ✅ Fetch Job from serviceM8 and sync to Hubspot as Deal
  syncServiceM8JobToHubSpotAsDeal,
  // ✅ Fetch Note from serviceM8 and sync to Hubspot as Activity
  syncServiceM8NoteToHubSpotAsActivity,
  // ✅ Fetch Client from serviceM8 and sync to Hubspot as Company
  syncServiceM8ClientToHubSpotAsCompany,
} from "../services/serviceM8.service.js";
logger.info(`Scheduler Initialized fro ServiceM8-Hubspot successfully...`);
let isRunning = false; // Flag to prevent overlapping executions
const schedulerFrequesncy = "0 */5 * * * *"; // Every 5 min (for testing, adjust as needed for production)

cron.schedule(schedulerFrequesncy, async () => {
  // Simultaneously handle both ServiceM8 and Hubspot tasks
  try {
    if (isRunning) {
      logger.info(`ServiceM8-Hubspot is already running...`);
      return;
    }
    logger.info("Polling ServiceM8-Hubspot started...");

    // await Promise.allSettled([
    await syncServiceM8ClientToHubSpotAsContact();
    await syncServiceM8ClientToHubSpotAsCompany();
    await syncServiceM8JobToHubSpotAsDeal();
    await syncServiceM8NoteToHubSpotAsActivity();
    // ]);
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
