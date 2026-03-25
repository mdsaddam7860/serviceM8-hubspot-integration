import cron from "node-cron";
import { logger } from "../index.js";
import {
  // ---------------- [ ServiceM8 → HubSpot Sync ] ----------------
  // Client → Contact
  syncServiceM8ClientToHubSpotAsContact,
  // Job → Deal
  syncServiceM8JobToHubSpotAsDeal,
  // Note → Activity (Timeline)
  syncServiceM8NoteToHubSpotAsActivity,
  // Client → Company
  syncServiceM8ClientToHubSpotAsCompany,
  // Job Checklist → Tasks
  syncServiceM8JobChecklistToHubSpotAsTasks,
} from "../services/serviceM8.service.js";

// const schedulerFrequesncy = "0 */2 * * * *"; // Every 2 min (for testing, adjust as needed for production)
const schedulerFrequesncy = "0 * * * *"; // Every Hour at min 0 (for testing, adjust as needed for production)

let isRunning = false; // Flag to prevent overlapping executions

logger.info(
  `Scheduler Initialized fro ServiceM8-Hubspot successfully Sync-Frequency ${schedulerFrequesncy}`
);
cron.schedule(schedulerFrequesncy, async () => {
  // Simultaneously handle both ServiceM8 and Hubspot tasks
  try {
    if (isRunning) {
      logger.info(`ServiceM8-Hubspot is already running...`);
      return;
    }

    isRunning = true;
    logger.info("Polling ServiceM8-Hubspot started...");

    // await Promise.allSettled([
    // await syncServiceM8ClientToHubSpotAsContact();
    // await syncServiceM8ClientToHubSpotAsCompany();
    await syncServiceM8JobToHubSpotAsDeal();
    await syncServiceM8NoteToHubSpotAsActivity();
    await syncServiceM8JobChecklistToHubSpotAsTasks();
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
