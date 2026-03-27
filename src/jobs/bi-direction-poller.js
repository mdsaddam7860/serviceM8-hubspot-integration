import cron from "node-cron";
import { logger } from "../index.js";
import { saveLastSyncTime } from "../utils/helper.util.js";
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
  ServiceM8ToHubspotSync,
} from "../services/serviceM8.service.js";

import {
  // --------------------------[Hubspot -> ServiceM8]--------------------------
  //  Deal -> Job
  syncHubspotDealToServiceM8Job,
  // Contact -> Client
  syncHubspotContactToServiceM8Client,
  // Company -> Client
  syncHubspotCompanyToServiceM8Client,
  HubspotToServiceM8Sync,
} from "../services/hubspot.service.js";

// const schedulerFrequesncy = "*/10 * * * * *"; // Every 2 min (for testing, adjust as needed for production)
const schedulerFrequesncy = "*/2 * * * *"; // Every min 30 (for testing, adjust as needed for production)

let isRunning = false; // Flag to prevent overlapping executions

logger.info(
  `Scheduler Initialized from ServiceM8-Hubspot and Hubspot-ServiceM8(Bi-Directional Scheduler) successfully Sync-Frequency ${schedulerFrequesncy}`
);
cron.schedule(schedulerFrequesncy, async () => {
  // Simultaneously handle both ServiceM8 and Hubspot tasks
  const date = new Date().toISOString();
  try {
    if (isRunning) {
      logger.info(
        `ServiceM8-Hubspot and Hubspot-ServiceM8(Bi-Directional Scheduler) is already running...`
      );
      return;
    }
    isRunning = true;
    logger.info(
      "ServiceM8-Hubspot and Hubspot-ServiceM8(Bi-Directional Scheduler) started..."
    );

    // Runs one after the other. Logs will be perfectly grouped. Running Both Sync Simaltaneously will cause logs to be out of order.and harder to debug later.
    await HubspotToServiceM8Sync();
    await ServiceM8ToHubspotSync();
  } catch (error) {
    logger.error(
      "Critical startup failure at ServiceM8-Hubspot and Hubspot-ServiceM8(Bi-Directional Scheduler):",
      {
        httpStatus: error?.status,
        response: error.response?.data,
        message: error.message,
        stack: error.stack,
      }
    );
  } finally {
    isRunning = false; // Reset the flag after execution
    saveLastSyncTime(date);
  }
});
