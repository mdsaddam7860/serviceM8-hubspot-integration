import { logger, delta, currentDate } from "../index.js";
import { getServiceM8Client } from "../configs/serviceM8.config.js";
import { hubspotExecutor, serviceM8Executor } from "../utils/executors.js";
import {
  processBatchContactInHubspot,
  processBatchDealInHubspot,
  processBatchActivityInHubspot,
} from "./hubspot.service.js";

const clientEndpoint = "company.json";
const jobsEndpoint = "job.json";
const staffsEndpoint = "staff.json";
const NotesEndpoint = "note.json";

/**
 * Fetches all records from a ServiceM8 endpoint using cursor-based pagination.
 * @param {string} endpoint - e.g., 'company.json'
 * @returns {Promise<Array>} - All combined records
 */
async function fetchAllServiceM8Records(endpoint) {
  let allRecords = [];
  let nextCursor = "-1"; // Documentation specifies -1 for the first page
  let pageCount = 0;
  const serviceM8Client = getServiceM8Client();

  try {
    while (nextCursor) {
      pageCount++;

      // We use the executor you built to handle rate limiting (2 calls/sec)
      const response = await serviceM8Executor(
        async () => {
          return await serviceM8Client.get(endpoint, {
            params: { cursor: nextCursor },
          });
        },
        { endpoint, page: pageCount }
      );

      const data = response.data;

      // Ensure data is an array before spreading
      if (Array.isArray(data)) {
        allRecords.push(...data);
      } else {
        // Some ServiceM8 endpoints return a single object or empty string if no results
        if (data) allRecords.push(data);
      }

      // Get the cursor for the next page from response headers
      nextCursor = response.headers["x-next-cursor"];

      logger.info(`Fetched page ${pageCount} for ${endpoint}`, {
        count: data?.length || 0,
        totalSoFar: allRecords.length,
        hasNextPage: !!nextCursor,
      });
    }

    return allRecords;
  } catch (error) {
    logger.error(`Failed to fetch paginated data from ${endpoint}`, {
      //   message: error.message,
      //   stack: error.stack,
      status: error.response?.status,
      response: error.response?.data,
      method: error.config?.method,
      url: error.config?.url,
      headers: error.config?.headers,
    });
    throw error;
  }
}

async function* serviceM8Generator(
  endpoint,
  {
    serviceM8Client = getServiceM8Client(),
    executor = serviceM8Executor,
    log = logger,
  } = {}
) {
  let nextCursor = "-1";
  let pageCount = 0;
  let totalProcessed = 0;
  const startTime = Date.now();

  try {
    while (nextCursor) {
      pageCount++;

      const response = await executor(
        async () => {
          return await serviceM8Client.get(endpoint, {
            params: { cursor: nextCursor },
          });
        },
        { endpoint, page: pageCount }
      );

      const data = response.data || [];
      const records = Array.isArray(data) ? data : [data];

      totalProcessed += records.length;

      // Calculate Stats
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const recordsPerSecond = (totalProcessed / elapsedSeconds).toFixed(2);

      // Yield data + metadata for the consumer
      yield {
        records,
        stats: {
          page: pageCount,
          totalProcessed,
          recordsPerSecond,
          elapsedSeconds: elapsedSeconds.toFixed(1),
        },
      };

      nextCursor = response.headers["x-next-cursor"];

      // log.info(`[ServiceM8 Progress] ${endpoint}`, {
      //   page: pageCount,
      //   processed: totalProcessed,
      //   speed: `${recordsPerSecond} rec/sec`,
      // });
    }
  } catch (error) {
    log.error(`Stream interrupted at page ${pageCount}`, {
      status: error.response?.status,
      response: error.response?.data,
      method: error.config?.method,
      url: error.config?.url,
      headers: error.config?.headers,
    });
    throw error;
  }
}
/**
 * 
 * logger.error("HubSpot Axios error", {
      status: error.response?.status,
      response: error.response?.data,
      method: error.config?.method,
      url: error.config?.url,
      headers: error.config?.headers,
    });
 */
/**
 * Specific function for the Company endpoint
 */
const getAllClient = () => fetchAllServiceM8Records("company.json");
const getAllJobs = () => fetchAllServiceM8Records("job.json");
const getAllStaffs = () => fetchAllServiceM8Records("staff.json");
const getAllNotes = () => fetchAllServiceM8Records("note.json");

// async function syncAllCompanies() {
//   const companyPages = serviceM8Generator("company.json");

//   for await (const page of companyPages) {
//     // page is an array of ~5,000 records
//     logger.info(`Processing a batch of ${page.length} companies...`);

//     // Example: Save to DB in chunks
//     // await MyDatabase.bulkInsert(page);

//     // Once this loop iteration finishes, the 'page' variable can be
//     // garbage collected, saving your RAM!
//   }

//   logger.info("ServiceM8 Sync Complete.");
// }

async function syncCompaniesTask() {
  const companyStream = serviceM8Generator("company.json");

  for await (const { records, stats } of companyStream) {
    // 1. Process the batch (e.g., Save to DB)
    // await processBatchInDatabase(records);

    logger.info(`Processing a batch of ${records.length} companies...`);
    logger.info(`Stats : ${JSON.stringify(stats, null, 2)}`);
    // logger.info(`Record : ${JSON.stringify(records[0], null, 2)}`);

    // 2. Clear progress update
    // console.clear();
    logger.info(
      `🚀 Syncing ServiceM8: ${stats.totalProcessed} records indexed...`
    );
    logger.info(
      `⏱️  Time elapsed: ${stats.elapsedSeconds}s | Speed: ${stats.recordsPerSecond} rec/s`
    );
  }

  logger.info("✅ Full sync successful.");
}

// Internal logic for syncing
const syncServiceM8ToHubSpot = async () => {
  const companyStream = serviceM8Generator("company.json");
  let total = 0;

  for await (const { records, stats } of companyStream) {
    // Heavy lifting: Send records to HubSpot service
    // await hubSpotService.upsertCompanies(records);
    total = stats.totalProcessed;
  }

  return { totalSynced: total };
};

async function syncServiceM8ClientToHubSpotAsContact() {
  try {
    const endpoint = "company.json";
    const date = new Date();
    date.setDate(date.getDate() - 1);

    const previousDate = date.toISOString().split("T")[0];
    logger.info(`Getting records after: ${previousDate}`);
    const companyStream = serviceM8Generator(
      `${endpoint}?$filter=edit_date gt ${previousDate}`
    );

    for await (const { records, stats } of companyStream) {
      await processBatchContactInHubspot(records);
      // console.clear();
      // logger.info(
      //   `🚀 Syncing ServiceM8: ${stats.totalProcessed} records indexed... `
      // );
      // logger.info(
      //   `⏱️ Time elapsed: ${stats.elapsedSeconds}s | Speed: ${stats.recordsPerSecond} rec/s`
      // );
      logger.info(`[ServiceM8 Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
    }

    logger.info("✅ Full sync successful.");
  } catch (error) {
    logger.error(`❌ Full sync failed.`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error.message,
    });
    throw error;
  }
}
async function syncServiceM8JobToHubSpotAsDeal() {
  try {
    const current_date = currentDate();
    logger.info(`Getting records : ${current_date}`);

    const endpoint = `job.json?$filter=date eq ${current_date}`;

    const jobStream = serviceM8Generator(endpoint);

    for await (const { records, stats } of jobStream) {
      await processBatchDealInHubspot(records);
      // console.clear();
      // logger.info(
      //   `🚀 Syncing ServiceM8: ${stats.totalProcessed} records indexed... `
      // );
      // logger.info(
      //   `⏱️ Time elapsed: ${stats.elapsedSeconds}s | Speed: ${stats.recordsPerSecond} rec/s`
      // );
      logger.info(`[ServiceM8 Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
    }

    logger.info("✅ Full sync successful.");
  } catch (error) {
    logger.error(`❌ Full sync failed.`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error.message,
    });
    throw error;
  }
}
async function syncServiceM8NoteToHubSpotAsActivity() {
  try {
    const current_date = delta();
    logger.info(`Getting records : ${current_date}`);

    const endpoint = `note.json?$filter=edit_date gt ${current_date}`;

    const jobStream = serviceM8Generator(endpoint);

    for await (const { records, stats } of jobStream) {
      await processBatchActivityInHubspot(records);
      // console.clear();
      // logger.info(
      //   `🚀 Syncing ServiceM8: ${stats.totalProcessed} records indexed... `
      // );
      // logger.info(
      //   `⏱️ Time elapsed: ${stats.elapsedSeconds}s | Speed: ${stats.recordsPerSecond} rec/s`
      // );
      logger.info(`[ServiceM8 Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
    }

    logger.info("✅ Full sync successful.");
  } catch (error) {
    logger.error(`❌ Full sync failed.`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error.message,
    });
    throw error;
  }
}

export {
  getAllClient,
  getAllJobs,
  getAllStaffs,
  getAllNotes,
  syncCompaniesTask,
  syncServiceM8ToHubSpot,
  syncServiceM8ClientToHubSpotAsContact,
  syncServiceM8JobToHubSpotAsDeal,
  syncServiceM8NoteToHubSpotAsActivity,
};
