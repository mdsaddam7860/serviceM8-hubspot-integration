import { getServiceM8Client } from "../configs/serviceM8.config.js";
import { hubspotExecutor, serviceM8Executor } from "../utils/executors.js";
// -----------------------------------Index -----------------------------------------
import {
  logger,
  delta,
  currentDate,
  clientMappingHSTOSM8,
  companyMappingHSTOSM8,
  contactMappingHSTOSM8,
  jobMappingHSTOSM8,
  companyContactMappingHSTOSM8,
  contactProperties,
  jobContactMappingHSTOSM8,
  dealProperties,
  getLastSyncTime,
} from "../index.js";
// -----------------------------------Hubspot Service -----------------------------------------
import {
  fetchHubSpotObject,
  processBatchContactInHubspot,
  processBatchDealInHubspot,
  processBatchActivityInHubspot,
  processBatchCompanyInHubspot,
  fetchHubSpotAssociationIds,
  processBatchTasksInHubspot,
} from "./hubspot.service.js";

const SECURITY_ROLES = Object.freeze({
  //Service Technician
  "28c8be89-e90b-46c9-a914-235034c9335b": "Service Technician",

  // Contractor
  "0f4ec4f8-4976-4119-8d93-22de0c640e7b": "Contractor",
});

const JOB_CATEGORY_UUID = Object.freeze({
  /**!SECTION
   *  I - Council Application  84655c31-55d7-4509-8681-20156066eeab
   *  I - Emma Quote           3f20f466-f849-4bfa-ab52-23e6fe361feb
   *  I - Nick Quote           6642ee12-d5ea-4e88-b081-1cd9fc0ef11b
   *  I - Supply Only          9f41bb38-b426-477c-bc58-20c454051fab
   *  M - Contractor           ec7ccf61-b811-459c-b006-22f3866d35fb
   *  M - Maintenance          f4460be7-395d-42ca-a465-22f384e3a8fb
   *  S - Maintenance          b4150a2b-1114-49b0-bbc5-23e7c61e2f7b
   */
  "84655c31-55d7-4509-8681-20156066eeab": "I - Council Application",
  "9f41bb38-b426-477c-bc58-20c454051fab": "I - Supply Only",
  "3f20f466-f849-4bfa-ab52-23e6fe361feb": "I - Emma Quote",
  "6642ee12-d5ea-4e88-b081-1cd9fc0ef11b": "I - Nick Quote",
  "ec7ccf61-b811-459c-b006-22f3866d35fb": "M-Contractor",
  "f4460be7-395d-42ca-a465-22f384e3a8fb": "M-Maintenance",
  "b4150a2b-1114-49b0-bbc5-23e7c61e2f7b": "S-Maintence",
});

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
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
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
      stack: error?.stack || error,
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

// ✅ Fetch Client from serviceM8 and sync to Hubspot as Contact
async function syncServiceM8ClientToHubSpotAsContact() {
  try {
    const endpoint = "company.json";

    const lastSyncISO = getLastSyncTime();

    const formattedDate = lastSyncISO.replace("T", " ").split(".")[0];
    logger.info(`Getting records : ${formattedDate}`);

    const companyStream = serviceM8Generator(
      `${endpoint}?$filter=edit_date gt '${formattedDate}' and is_individual eq 1`
    );

    for await (const { records, stats } of companyStream) {
      await processBatchContactInHubspot(records);

      logger.info(`[ServiceM8 Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
    }

    logger.info(`[ServiceM8] Generator Completed for ${endpoint}`);
  } catch (error) {
    logger.error(`❌ Full sync failed.`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
  }
}
// ✅ Fetch Client from serviceM8 and sync to Hubspot as Company
async function syncServiceM8ClientToHubSpotAsCompany() {
  try {
    const lastSyncISO = getLastSyncTime();

    const formattedDate = lastSyncISO.replace("T", " ").split(".")[0];
    logger.info(`Getting records : ${formattedDate}`);

    const companyStream = serviceM8Generator(
      `${clientEndpoint}?$filter=edit_date gt '${formattedDate}' and is_individual eq 0`
    );

    for await (const { records, stats } of companyStream) {
      // Process Company in batch here
      await processBatchCompanyInHubspot(records);

      logger.info(`[ServiceM8 Progress] ${clientEndpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
    }

    logger.info(`[ServiceM8] Generator Completed for ${endpoint}`);
  } catch (error) {
    logger.error(`❌ Full sync failed.`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
  }
}
// ✅ Fetch Job from serviceM8 and sync to Hubspot as Deal
async function syncServiceM8JobToHubSpotAsDeal() {
  try {
    const lastSyncISO = getLastSyncTime();

    const formattedDate = lastSyncISO.replace("T", " ").split(".")[0];
    logger.info(`Getting records : ${formattedDate}`);

    const endpoint = `job.json?$filter=edit_date eq '${formattedDate}'`;
    // const endpoint = `job.json`;

    const jobStream = serviceM8Generator(endpoint);

    for await (const { records, stats } of jobStream) {
      await processBatchDealInHubspot(records);

      logger.info(`[ServiceM8 Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
    }

    logger.info(`[ServiceM8] Generator Completed for ${endpoint}`);
  } catch (error) {
    logger.error(`❌ Full sync failed.`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
    throw error;
  }
}
// ✅ Fetch Note from serviceM8 and sync to Hubspot as Activity
async function syncServiceM8NoteToHubSpotAsActivity() {
  try {
    const lastSyncISO = getLastSyncTime();

    // Convert to Date
    const dateObj = new Date(lastSyncISO);

    // Add 30 minutes
    dateObj.setMinutes(dateObj.getMinutes() + 30);

    // Format back
    const formattedDate = dateObj.toISOString().replace("T", " ").split(".")[0];

    logger.info(`Getting records : ${formattedDate}`);

    const endpoint = `note.json?$filter=edit_date gt '${formattedDate}'`;

    const jobStream = serviceM8Generator(endpoint);

    for await (const { records, stats } of jobStream) {
      await processBatchActivityInHubspot(records);

      logger.info(`[ServiceM8 Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
    }

    logger.info(`[ServiceM8] Generator Completed for ${endpoint}`);
  } catch (error) {
    logger.error(`❌ Full sync failed.`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
  }
}
// ✅ Fetch technician-added tasks from serviceM8 and sync to Hubspot as Activity
async function syncServiceM8JobChecklistToHubSpotAsTasks() {
  try {
    const lastSyncISO = getLastSyncTime();

    const formattedDate = lastSyncISO.replace("T", " ").split(".")[0];
    logger.info(`Getting records : ${formattedDate}`);

    // const endpoint = `jobchecklist.json`;
    const endpoint = `jobchecklist.json?$filter=edit_date gt '${formattedDate}'`;

    const jobStream = serviceM8Generator(endpoint);

    for await (const { records, stats } of jobStream) {
      logger.info(
        `Processing a batch of ${records.length} records & endpoint ${endpoint}`
      );
      await processBatchTasksInHubspot(records);

      logger.info(`[ServiceM8 Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
    }

    logger.info(`[ServiceM8] Generator Completed for ${endpoint}`);
  } catch (error) {
    logger.error(`❌ Full sync failed.`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
  }
}

// ✅ Fetch Client from serviceM8 and sync to Hubspot as Contact
// async function syncServiceM8CompanyContactToHubSpotAsContact() {
//   try {
//     const endpoint = "companycontact.json";
//     const date = new Date();
//     date.setDate(date.getDate() - 1);

//     const previousDate = date.toISOString().split("T")[0];
//     logger.info(`Getting records after: ${previousDate}`);
//     const companyStream = serviceM8Generator(endpoint);
//     // const companyStream = serviceM8Generator(
//     //   `${endpoint}?$filter=edit_date gt ${previousDate} and is_individual eq 1`
//     // );

//     for await (const { records, stats } of companyStream) {
//       logger.info(`Record: ${JSON.stringify(records[0], null, 2)}`);
//       await processBatchContactInHubspot(records);
//       // console.clear();
//       // logger.info(
//       //   `🚀 Syncing ServiceM8: ${stats.totalProcessed} records indexed... `
//       // );
//       // logger.info(
//       //   `⏱️ Time elapsed: ${stats.elapsedSeconds}s | Speed: ${stats.recordsPerSecond} rec/s`
//       // );
//       logger.info(`[ServiceM8 Progress] ${endpoint}`, {
//         page: stats.page,
//         processed: stats.totalProcessed,
//         speed: `${stats.recordsPerSecond} rec/sec`,
//       });
//       return;
//     }

//     logger.info("✅ Full sync successful.");
//   } catch (error) {
//     logger.error(`❌ Full sync failed.`, {
//       status: error?.status,
//       response: error.response?.data,
//       method: error?.method,
//       url: error?.config?.url,
//       headers: error?.config?.headers,
//       message: error.message,
//     });
//     throw error;
//   }
// }

async function searchInServiceM8(endpoint, uuid) {
  if (!endpoint || !uuid) {
    logger.warn("Missing endpoint or uuid");
    return null;
  }
  const query = `${endpoint}/${uuid}`;
  try {
    const serviceM8client = getServiceM8Client();
    const response = await serviceM8client.get(query);
    logger.info(
      `[ServiceM8] Fetched ${query} : ${JSON.stringify(response.data, null, 2)}`
    );
    return response.data;
  } catch (error) {
    logger.error(`❌ failed to fetch ${query}:${uuid}`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
    throw error;
  }
}
async function searchInServiceM8CustomFiled(endpoint, key, value) {
  if (!endpoint || !key || !value) {
    logger.warn(`Missing endpoint or key or value endpoint:${endpoint}
    , key :${key}, value:${value}`);
    return null;
  }
  const query = `${endpoint}$filter=${key} eq '${value}'`;
  try {
    const serviceM8client = getServiceM8Client();
    const response = await serviceM8client.get(query);
    logger.info(`Fetched ${query} : ${JSON.stringify(response.data, null, 2)}`);
    return response.data;
  } catch (error) {
    logger.error(`❌ failed to fetch ${query}:${uuid}`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
    throw error;
  }
}
async function searchInServiceM8UsingCustomField(
  endpoint,
  customField,
  customValue
) {
  if (!endpoint || !customField || !customValue) {
    logger.warn(
      `Missing endpoint:${endpoint},or customValue:${customValue}, or customField:${customField}`
    );
    return null;
  }

  const query = `${endpoint}`;

  try {
    const serviceM8client = getServiceM8Client();

    const response = await serviceM8Executor(
      () => {
        return serviceM8client.get(query, {
          params: {
            $filter: `${customField} eq '${customValue}'`,
          },
        });
      },
      {
        name: `searchInServiceM8UsingCustomField endpoint:${endpoint},or customValue:${customValue}, or customField:${customField}`,
      }
    );

    // const response = await serviceM8client.get(query, {
    //   params: {
    //     $filter: `${customField} eq '${customValue}'`,
    //   },
    // });

    // logger.info(`Fetched ${query} : ${JSON.stringify(response.data, null, 2)}`);

    return response.data || null; // Return the first match or null if no matches
  } catch (error) {
    logger.error(
      `❌ failed to fetch ${query} : ${customField} : ${customValue}`,
      {
        status: error?.status,
        response: error.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error.message,
        stack: error?.stack || error,
      }
    );

    throw error;
  }
}

async function upsertjobInServiceM8(record = {}) {
  try {
    let existingJob = null;
    if (record.properties?.job_uuid_service_m8) {
      existingJob = await searchInServiceM8UsingCustomField(
        "job.json",
        "uuid",
        record.properties?.job_uuid_service_m8
      );
    }

    let payload = null;

    if (existingJob && existingJob.length > 0) {
      payload = jobMappingHSTOSM8(record, existingJob[0]?.uuid);
    } else {
      payload = jobMappingHSTOSM8(record);
    }
    logger.info(`Payload : ${JSON.stringify(payload, null, 2)}`);
    const serviceM8client = getServiceM8Client();

    const response = await serviceM8Executor(
      () => {
        return serviceM8client.post("job.json", payload);
      },
      { name: `upsertjobInServiceM8 ${JSON.stringify(payload, null, 2)}` }
    );

    if (response?.data?.message === "OK") {
      return response?.headers?.["x-record-uuid"];
    }

    return response.data;
  } catch (error) {
    logger.error("❌ Error processing Job in upsertjobInServiceM8", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
    throw error;
  }
}

async function processBatchDealInServiceM8(
  records = [
    {
      id: "250551372279",
      properties: {
        amount: "22725.55",
        billing_address_service_m8: null,
        completion_date_service_m8: null,
        createdate: "2026-02-23T02:15:27.243Z",
        dealname: "42184 Tallon Dev",
        dealstage: "2114542054",
        generated_job_id_service_m8: null,
        hs_lastmodifieddate: "2026-03-02T22:04:03.967Z",
        hs_object_id: "250551372279",
        invoice_sent_service_m8: null,
        invoice_sent_timestamp_service_m8: null,
        job_address_service_m8: null,
        job_description_service_m: null,
        job_status_servicem8: "Completed",
        job_unsuccessful_date_service_m8: null,
        job_uuid_service_m8: null,
        payment_received_service_m8: null,
        payment_received_timestamp_service_m8: null,
        pipeline: "default",
        purchase_order_number_service_m8: null,
        quote_sent_service_m8: null,
        quote_sent_timestamp_service_m8: null,
        sourceid: null,
        work_order_date_service_m8: null,
      },
      createdAt: "2026-02-23T02:15:27.243Z",
      updatedAt: "2026-03-02T22:04:03.967Z",
      archived: false,
      url: "https://app-ap1.hubspot.com/contacts/442485870/record/0-3/250551372279",
    },
    // {
    //   id: "256557081081",
    //   properties: {
    //     amount: "12",
    //     billing_address_service_m8: null,
    //     completion_date_service_m8: null,
    //     createdate: "2026-03-03T15:13:23.736Z",
    //     dealname: "Test deal 2",
    //     dealstage: "2564260296",
    //     generated_job_id_service_m8: null,
    //     hs_lastmodifieddate: "2026-03-03T15:14:02.929Z",
    //     hs_object_id: "256557081081",
    //     invoice_sent_service_m8: null,
    //     invoice_sent_timestamp_service_m8: null,
    //     job_address_service_m8: null,
    //     job_description_service_m: null,
    //     job_status_servicem8: "Quote",
    //     job_unsuccessful_date_service_m8: null,
    //     job_uuid_service_m8: null,
    //     payment_received_service_m8: null,
    //     payment_received_timestamp_service_m8: null,
    //     pipeline: "default",
    //     purchase_order_number_service_m8: null,
    //     quote_sent_service_m8: null,
    //     quote_sent_timestamp_service_m8: null,
    //     sourceid: null,
    //     work_order_date_service_m8: null,
    //   },
    //   createdAt: "2026-03-03T15:13:23.736Z",
    //   updatedAt: "2026-03-03T15:14:02.929Z",
    //   archived: false,
    //   url: "https://app-ap1.hubspot.com/contacts/442485870/record/0-3/256557081081",
    // },
  ]
) {
  try {
    const recordLength = records.length;
    for (const [index, record] of records.entries()) {
      await processSingleJobInServiceM8(record, index, recordLength);
    }
  } catch (error) {
    logger.error("❌ Error processing Deal in Batch", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
  }
}

async function processSingleJobInServiceM8(record, index, recordLength) {
  try {
    logger.info(
      `Processing at index - ${
        index + 1
      }/${recordLength} : [Hubspot Deal] : ${JSON.stringify(record, null, 2)}`
    );

    if (!record?.properties?.job_status_servicem8) {
      logger.warn(
        `No status found for record : ${JSON.stringify(record)}. Skipping...`
      );
      return;
    }

    const [upsertJobResult, contactResult] = await Promise.allSettled([
      upsertjobInServiceM8(record),
      fetchHubSpotAssociationIds("deals", "contacts", record?.id),
    ]);

    // 3. Defensive Status Checking
    if (upsertJobResult.status === "rejected") {
      logger.error(
        `❌ Job upsert failed for ${record?.id}: ${upsertJobResult.reason}`
      );
      return;
    }

    const upsertJob = upsertJobResult.value;
    const associated_contact_ids =
      contactResult.status === "fulfilled" ? contactResult.value : [];

    if (!upsertJob) {
      logger.warn(`Could not upsert job for ${record?.id}`);
      return;
    }

    // 4. Process Contacts (With individual error boundaries)
    if (associated_contact_ids.length > 0) {
      await processAssociatedContacts(associated_contact_ids, upsertJob);
    }
  } catch (error) {
    logger.error(
      `[ServiceM8] Error processing job [processSingleJobInServiceM8] ${JSON.stringify(
        record
      )}`,
      {
        status: error?.status,
        response: error.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error.message,
        stack: error?.stack || error,
      }
    );
  }
}

// Separate logic for better readability and testing
async function processAssociatedContacts(contactIds, upsertJob) {
  return Promise.allSettled(
    contactIds.map(async (contactId) => {
      try {
        const contactDetails = await fetchHubSpotObject(
          "contacts",
          contactId,
          dealProperties()
        );

        if (!contactDetails) return;

        const upsertjobcontact = await upsertJobContactInServiceM8(
          contactDetails,
          upsertJob
        );
        logger.info(
          `✅ Successfully associated contact ${contactId} to jobContact UUID : ${upsertjobcontact}.`
        );
        return upsertjobcontact;
      } catch (error) {
        logger.error(`❌ Error processing contact ${contactId}`, {
          status: error?.status,
          response: error.response?.data,
          method: error?.method,
          url: error?.config?.url,
          message: error.message,
          stack: error?.stack || error,
        });
      }
    })
  );
}

async function upsertContactInServiceM8(record) {
  try {
    let existingContact = null;
    existingContact = await searchInServiceM8UsingCustomField(
      "company.json",
      "name",
      `${record?.properties?.firstname} ${record?.properties?.lastname}`
    );

    let payload = null;
    if (existingContact) {
      payload = contactMappingHSTOSM8(record, existingContact);
    } else {
      payload = contactMappingHSTOSM8(record);
    }

    const serviceM8client = getServiceM8Client();

    logger.info(`Payload : ${JSON.stringify(payload, null, 2)}`);

    const response = await serviceM8Executor(
      () => serviceM8client.post("company.json", payload),
      { name: "upsertContactInServiceM8" }
    );
    if (response?.data?.message === "OK") {
      return response.headers["x-record-uuid"];
    }
    return response.data;
  } catch (error) {
    logger.error("❌ Error processing Client in Batch", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
    throw error;
  }
}
async function upsertCompanyContactInServiceM8(record = {}, company_uuid) {
  try {
    // search contact in serviceM8 based on email if found update else create(upsert based on email)

    let existingContact = null;
    existingContact = await searchInServiceM8UsingCustomField(
      "companycontact.json",
      "email",
      record.properties?.email
    );

    if (!existingContact) {
      // search based on phone number
      existingContact = await searchInServiceM8UsingCustomField(
        "companycontact.json",
        "phone",
        record.properties?.phone
      );
    }

    let payload = null;
    if (existingContact && existingContact.length > 0) {
      logger.info(
        `Existing companycontact: ${JSON.stringify(existingContact)}`
      );
      payload = companyContactMappingHSTOSM8(
        record,
        company_uuid,
        existingContact
      );
    } else {
      payload = companyContactMappingHSTOSM8(record, company_uuid);
    }

    if (!payload) {
      logger.warn(`Payload not found for ${JSON.stringify(record)}`);
      return;
    }

    const serviceM8client = getServiceM8Client();

    logger.info(`Payload : ${JSON.stringify(payload)}`);

    const response = await serviceM8Executor(
      () => serviceM8client.post("companycontact.json", payload),
      { name: `upsertCompanyContactInServiceM8 ${record.id}` }
    );
    // logger.info(`Upsert CompanyContact : ${JSON.stringify(response.data, null, 2)}`);
    // console.log("response", response);

    if (response?.data?.message === "OK") {
      return response.headers["x-record-uuid"];
    }

    return response.data;
  } catch (error) {
    logger.error("❌ Error processing Client in Batch", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
    throw error;
  }
}
async function upsertJobContactInServiceM8(record = {}, job_uuid) {
  try {
    // search contact in serviceM8 based on email if found update else create(upsert based on email)

    let existingContact = null;
    existingContact = await searchInServiceM8UsingCustomField(
      "jobcontact.json",
      "email",
      record.properties?.email
    );

    if (!existingContact) {
      // search based on phone number
      existingContact = await searchInServiceM8UsingCustomField(
        "jobcontact.json",
        "phone",
        record?.properties?.phone
      );
    }

    let payload = null;
    if (existingContact && existingContact.length > 0) {
      logger.info(`Existing jobcontact: ${JSON.stringify(existingContact)}`);
      payload = jobContactMappingHSTOSM8(record, job_uuid, existingContact);
    } else {
      payload = jobContactMappingHSTOSM8(record, job_uuid);
    }

    if (!payload) {
      logger.warn(`Payload not found for ${JSON.stringify(record, null, 2)}`);
      return;
    }

    const serviceM8client = getServiceM8Client();

    logger.info(`Payload : ${JSON.stringify(payload, null, 2)}`);

    const response = await serviceM8Executor(
      () => serviceM8client.post("jobcontact.json", payload),
      { name: `upsertCompanyContactInServiceM8 ${record.id}` }
    );

    if (response?.data?.message === "OK") {
      return response.headers["x-record-uuid"];
    }
    // logger.info(`Upsert CompanyContact : ${JSON.stringify(response.data, null, 2)}`);
    // console.log("response", response);

    return response.data;
  } catch (error) {
    logger.error("❌ Error processing Client in Batch", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
    throw error;
  }
}
async function upsertCompanyInServiceM8(record) {
  try {
    // Seacrh based on name , if found update else create(upsert based on name)

    let existingCompany = null;
    existingCompany = await searchInServiceM8UsingCustomField(
      "company.json",
      "name",
      record.properties?.name
    );

    let payload = null;
    if (existingCompany && existingCompany.length > 0) {
      logger.info(`Existing company: ${JSON.stringify(existingCompany)}`);
      payload = companyMappingHSTOSM8(record, existingCompany);
    } else {
      payload = companyMappingHSTOSM8(record);
    }
    const serviceM8client = getServiceM8Client();

    logger.info(`Payload : ${JSON.stringify(payload, null, 2)}`);

    const response = await serviceM8Executor(
      () => serviceM8client.post("company.json", payload),
      { name: `upsertClientInServiceM8 ${record.id}` }
    );

    if (response?.data?.message === "OK") {
      return response.headers["x-record-uuid"];
    }

    return response.data;
  } catch (error) {
    logger.error("❌ Error processing Client in Batch", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
    throw error;
  }
}

// Process Batch Contact from Hubspot to Service M8
async function processBatchContactInServiceM8(
  records = [
    // {
    //   id: "195745478080",
    //   properties: {
    //     about_us: null,
    //     address: null,
    //     address2: null,
    //     city: null,
    //     country: null,
    //     createdate: "2025-12-04T06:06:37.413Z",
    //     description: null,
    //     domain: "goldcoast.qld.gov.au",
    //     hs_country_code: null,
    //     hs_lastmodifieddate: "2026-03-02T06:12:58.173Z",
    //     hs_object_id: "195745478080",
    //     name: "City of Gold Coast",
    //     sourceid: null,
    //     state: null,
    //     zip: null,
    //   },
    //   createdAt: "2025-12-04T06:06:37.413Z",
    //   updatedAt: "2026-03-02T06:12:58.173Z",
    //   archived: false,
    //   url: "https://app-ap1.hubspot.com/contacts/442485870/record/0-2/195745478080",
    // },
    {
      id: "299134413246",
      properties: {
        createdate: "2026-02-17T09:27:10.691Z",
        email: "johnny@test.com",
        firstname: "Test ",
        hs_object_id: "299134413246",
        lastmodifieddate: "2026-03-03T15:30:52.738Z",
        lastname: "Contact",
      },
      createdAt: "2026-02-17T09:27:10.691Z",
      updatedAt: "2026-03-03T15:30:52.738Z",
      archived: false,
      url: "https://app-ap1.hubspot.com/contacts/442485870/record/0-1/299134413246",
    },
  ]
) {
  try {
    const recordLength = records.length;
    for (const [index, record] of records.entries()) {
      try {
        await processSingleContactInServiceM8(record, index, recordLength);
      } catch (error) {
        logger.error(
          `Error processing Contact in BatchLoop ${processBatchContactInServiceM8}-[ServiceM8]`,
          {
            status: error?.status,
            response: error.response?.data,
            method: error?.method,
            url: error?.config?.url,
            message: error.message,
            stack: error?.stack || error,
          }
        );
      }
    }
  } catch (error) {
    logger.error(`❌ Error processing Contact in Batch`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
  }
}

async function processSingleContactInServiceM8(record, index, recordLength) {
  try {
    logger.info(
      `[ServiceM8] Processing at index  ${
        index + 1
      }/${recordLength} : [Hubspot Contact] ${JSON.stringify(record)}`
    );

    const [upsertClientResult, contactResult] = await Promise.allSettled([
      upsertContactInServiceM8(record),
      // fetchHubSpotAssociationIds("contacts", "contacts", record?.id),
    ]);

    const upsertClient =
      upsertClientResult.status === "fulfilled"
        ? upsertClientResult.value
        : null;
    logger.info(
      `Upserted Company UUID : ${JSON.stringify(upsertClient, null, 2)}`
    );

    // 2. Guard: Handle HubSpot Upsert Failure
    // if (!upsertClient?.id) {
    //   logger.error(`❌ Skipped: Could not upsert Contact for ${record.uuid}`);
    //   continue;
    // }
    // const associated_contact_ids =
    //   contactResult.status === "fulfilled" ? contactResult.value : null;
    // logger.info(
    //   `Upserted Company UUID : ${JSON.stringify(upsertClient, null, 2)}`
    // );

    // await Promise.allSettled(
    //   associated_contact_ids.map(async (contactId) => {
    //     try {
    //       const contactDetails = await fetchHubSpotObject(
    //         "contacts",
    //         contactId,
    //         contactProperties()
    //       );

    //       logger.info(`contactDetails: ${JSON.stringify(contactDetails)}`);

    //       if (contactDetails) {
    //         const upsertCompanyContact =
    //           await upsertCompanyContactInServiceM8(
    //             contactDetails,
    //             upsertClient
    //           );
    //         logger.info(
    //           `Upserted CompanyContact: ${JSON.stringify(
    //             upsertCompanyContact
    //           )}`
    //         );
    //       }
    //     } catch (error) {
    //       logger.error(`❌ Error processing CompanyContact in batch`, {
    //         message: error.message,
    //         status: error.response?.status,
    //         data: error.response?.data,
    //         url: error.config?.url,
    //         method: error.config?.method,
    //       });
    //     }
    //   })
    // );
  } catch (error) {
    logger.error(
      ` Error processing Contact [processSingleCompanyInServiceM8]-[ServiceM8] ${JSON.stringify(
        record
      )}`,
      {
        status: error?.status,
        response: error.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error.message,
        stack: error?.stack || error,
      }
    );
  }
}

// Process Batch Company from Hubspot to Service M8
async function processBatchCompanyInServiceM8(
  records = [
    // {
    //   id: "195745478080",
    //   properties: {
    //     about_us: null,
    //     address: null,
    //     address2: null,
    //     city: null,
    //     country: null,
    //     createdate: "2025-12-04T06:06:37.413Z",
    //     description: null,
    //     domain: "goldcoast.qld.gov.au",
    //     hs_country_code: null,
    //     hs_lastmodifieddate: "2026-03-02T06:12:58.173Z",
    //     hs_object_id: "195745478080",
    //     name: "City of Gold Coast",
    //     sourceid: null,
    //     state: null,
    //     zip: null,
    //   },
    //   createdAt: "2025-12-04T06:06:37.413Z",
    //   updatedAt: "2026-03-02T06:12:58.173Z",
    //   archived: false,
    //   url: "https://app-ap1.hubspot.com/contacts/442485870/record/0-2/195745478080",
    // },
    {
      id: "252164202957",
      properties: {
        about_us: null,
        address: null,
        address2: null,
        city: null,
        country: null,
        createdate: "2026-03-03T10:29:36.525Z",
        description: "test company",
        domain: "testcompany.com",
        hs_country_code: null,
        hs_lastmodifieddate: "2026-03-03T11:13:14.281Z",
        hs_object_id: "252164202957",
        name: "Test Company",
        sourceid: null,
        state: null,
        zip: null,
      },
      createdAt: "2026-03-03T10:29:36.525Z",
      updatedAt: "2026-03-03T11:13:14.281Z",
      archived: false,
      url: "https://app-ap1.hubspot.com/contacts/442485870/record/0-2/252164202957",
    },
  ]
) {
  try {
    const recordLength = records.length;
    for (const [index, record] of records.entries()) {
      try {
        await processSingleCompanyInServiceM8(record, index, recordLength);
      } catch (error) {
        logger.error(
          `❌ Error processing Compnay in processBatchCompanyInServiceM8`,
          {
            status: error?.status,
            response: error.response?.data,
            method: error?.method,
            url: error?.config?.url,
            message: error.message,
            stack: error?.stack || error,
          }
        );
      }
    }
  } catch (error) {
    logger.error(
      `❌ Error processing Compnay in processBatchCompanyInServiceM8`,
      {
        status: error?.status,
        response: error.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error.message,
        stack: error?.stack || error,
      }
    );
  }
}

async function processSingleCompanyInServiceM8(record, index, recordLength) {
  try {
    logger.info(
      `Processing at index  ${
        index + 1
      }/${recordLength} | [Hubspot Company] ${JSON.stringify(record)}`
    );
    const [upsertClientResult, contactResult] = await Promise.allSettled([
      upsertCompanyInServiceM8(record),
      fetchHubSpotAssociationIds("companies", "contacts", record?.id),
    ]);

    if (upsertClientResult.status === "rejected") {
      logger.warn(
        `Could  not Upsert Company ${record?.id}: ${JSON.stringify(
          upsertClientResult.reason,
          null,
          2
        )}`
      );
      return;
    }

    const upsertClient =
      upsertClientResult.status === "fulfilled"
        ? upsertClientResult.value
        : null;

    const associated_contact_ids =
      contactResult.status === "fulfilled" ? contactResult.value : null;
    logger.info(
      `Upserted Company UUID : ${JSON.stringify(upsertClient, null, 2)}`
    );

    logger.info(
      `associated_contact_ids : ${JSON.stringify(associated_contact_ids)}`
    );

    await Promise.allSettled(
      associated_contact_ids.map(async (contactId) => {
        try {
          const contactDetails = await fetchHubSpotObject(
            "contacts",
            contactId,
            contactProperties()
          );

          logger.info(
            `[Hubspot] contactDetails: ${JSON.stringify(contactDetails)}`
          );

          if (contactDetails) {
            const upsertCompanyContact = await upsertCompanyContactInServiceM8(
              contactDetails,
              upsertClient
            );
            logger.info(
              `[ServiceM8] Upserted CompanyContact UUID: ${JSON.stringify(
                upsertCompanyContact
              )}`
            );
          }
        } catch (error) {
          logger.error(`Error processing CompanyContact in batch`, {
            status: error?.status,
            response: error.response?.data,
            method: error?.method,
            url: error?.config?.url,
            message: error.message,
            stack: error?.stack || error,
          });
        }
      })
    );
  } catch (error) {
    logger.error(
      `Error processing Compnay in [processSingleCompanyInServiceM8] | ${JSON.stringify(
        record
      )}`,
      {
        status: error?.status,
        response: error.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error.message,
        stack: error?.stack || error,
      }
    );
  }
}

async function ServiceM8ToHubspotSync() {
  try {
    await syncServiceM8JobToHubSpotAsDeal();
    await syncServiceM8NoteToHubSpotAsActivity();
    await syncServiceM8JobChecklistToHubSpotAsTasks();
  } catch (error) {
    logger.error(`❌ Full sync failed.`, {
      status: error?.status,
      errorMessage: error?.response?.message || "Unknown",
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      httpError: error?.stack || error,
      stack: error?.stack || error,
    });
  }
}
export {
  // ---------------- [ Configuration & Constants ] ----------------
  SECURITY_ROLES, // Access levels for ServiceM8
  JOB_CATEGORY_UUID, // Unique identifier for specific Job types

  // ---------------- [ ServiceM8 Write Operations ] ----------------
  upsertCompanyInServiceM8, // Create or update a Company
  upsertContactInServiceM8, // Create or update a Contact
  upsertjobInServiceM8, // Create or update a Job
  upsertCompanyContactInServiceM8, // Link Contact to Company

  // ---------------- [ ServiceM8 Search & Fetch ] ----------------
  getAllClient, // Fetch all Client records
  getAllJobs, // Fetch all Job records
  getAllStaffs, // Fetch all Staff/Technician records
  getAllNotes, // Fetch all Activity Notes
  searchInServiceM8, // General search utility
  searchInServiceM8UsingCustomField, // Filter by custom field values
  searchInServiceM8CustomFiled, // (Legacy/Alias) Custom field search

  // ---------------- [ Batch & Orchestration ] ----------------
  processBatchCompanyInServiceM8, // Bulk process Company syncs
  processBatchContactInServiceM8, // Bulk process Contact syncs
  processBatchDealInServiceM8, // Bulk process Deal/Job syncs
  syncCompaniesTask, // Orchestrate Company task sync
  syncServiceM8ToHubSpot, // Main entry point for full integration sync

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

  //--------------------------[ServiceM8 -> hubspot]---------------------
  ServiceM8ToHubspotSync,

  // SECURITY_ROLES,
  // JOB_CATEGORY_UUID,
  // // syncServiceM8CompanyContactToHubSpotAsContact,
  // upsertCompanyContactInServiceM8,
  // upsertContactInServiceM8,
  // upsertCompanyInServiceM8,
  // processBatchCompanyInServiceM8,
  // processBatchContactInServiceM8,
  // searchInServiceM8CustomFiled,
  // processBatchDealInServiceM8,
  // getAllClient,
  // getAllJobs,
  // getAllStaffs,
  // getAllNotes,
  // searchInServiceM8UsingCustomField,
  // syncCompaniesTask,
  // upsertjobInServiceM8,
  // syncServiceM8ToHubSpot,
  // searchInServiceM8,
  // ---------------- [ ServiceM8 → HubSpot Sync ] ----------------
  //[ServiceM8] - Fetch Client from serviceM8 and sync to Hubspot as Contact
  // syncServiceM8ClientToHubSpotAsContact,
  //[ServiceM8] - Fetch Job from serviceM8 and sync to Hubspot as Deal
  // syncServiceM8JobToHubSpotAsDeal,
  //[ServiceM8] - Fetch Note from serviceM8 and sync to Hubspot as Activity
  // syncServiceM8NoteToHubSpotAsActivity,
  //[ServiceM8] - Fetch Client from serviceM8 and sync to Hubspot as Company
  // syncServiceM8ClientToHubSpotAsCompany,
  //[ServiceM8] - Fetch technician-added tasks from serviceM8 and sync to Hubspot as Activity
  // syncServiceM8JobChecklistToHubSpotAsTasks,
};
