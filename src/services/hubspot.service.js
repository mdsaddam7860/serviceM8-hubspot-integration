import { logger } from "../index.js";
import { getHubspotClient, getHSAxios } from "../configs/hubspot.config.js";
import { hubspotExecutor, serviceM8Executor } from "../utils/executors.js";

async function upsertContactInHubspot(record = {}) {
  try {
    // Find contact if exist update else create deal
    const hs_client = getHubspotClient();

    const sourceid = record?.uuid;
    const payload = {
      firstname: record?.name,
      sourceid: sourceid,
    };

    // search contact based on sourceid

    const existingContact = await hs_client.contacts.getContactByCustomField(
      "sourceid",
      sourceid
    );
    // const existingContact = await hs_client.contacts.searchContacts(
    //   filterGroups,
    //   ["sourceid", "name"],
    //   1
    // );

    if (existingContact) {
      return await hs_client.contacts.updateContact(
        existingContact?.id,
        payload
      );
    } else {
      // create  contact
      return await hs_client.contacts.createContact(payload);
    }
  } catch (error) {
    logger.error("❌ HubSpot Contact failed to upsert:", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
    });
    throw error;
  }
}
async function upsertDealInHubspot(record = {}) {
  try {
    // Find deal if exist update else create deal
    const hs_client = getHubspotClient();

    const sourceid = record?.uuid;
    const payload = {
      dealname: record?.job_address,
      pipeline: "1322868159",
      sourceid: sourceid,
    };

    // search contact based on sourceid

    const existingDeal = await hs_client.deals.getDealByCustomField(
      "sourceid",
      sourceid
    );

    if (existingDeal) {
      logger.info(
        `Existing deal: ${JSON.stringify(existingDeal?.id, null, 2)}`
      );

      // Update Deal

      return await hs_client.deals.updateDeal(existingDeal?.id, payload);
    } else {
      // create  Deal
      return await hs_client.deals.createDeal(payload);
    }
  } catch (error) {
    logger.error("❌ HubSpot Deal failed to upsert:", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
    });

    throw error;
  }
}
async function upsertNoteInHubspot() {
  try {
    // Find Notes if exist update else create deal
    const hs_client = getHubspotClient();

    const notes = hs_client.customObject("notes");

    const sourceid = record?.uuid;
    // ❌ Create payload before testing and check if i only need to create notes (or update it also?)
    const payload = {
      note: record?.note,
      sourceid: sourceid,
    };

    // search Note based on sourceid

    const existingNote = await notes.getCustomObjectByCustomField(
      "sourceid",
      sourceid
    );

    if (existingNote) {
      logger.info(`Existing deal: ${JSON.stringify(existingNote, null, 2)}`);
      const result = await notes.update(existingNote?.id, payload);
      logger.info(`Created deal: ${JSON.stringify(result, null, 2)}`);

      // return await notes.update(existingNote?.id, payload);
    } else {
      // create  contact
      const result = await notes.create(payload);
      logger.info(`Created deal: ${JSON.stringify(result, null, 2)}`);
      // return await notes.createContact(payload);
    }
  } catch (error) {
    logger.error("❌ HubSpot Note failed to upsert", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
    });
    throw error;
  }
}
async function processBatchContactInHubspot(
  contacts = [
    {
      uuid: "0004567a-2c25-4d1c-bdad-1cd4559a391b",
      edit_date: "2021-03-22 14:36:20",
      name: "Tracey Dorge",
      website: "",
      abn_number: "",
      address: "17 Tarrawarrah Avenue\nTallai, Queensland",
      address_street: "17 Tarrawarrah Avenue",
      address_city: "Tallai",
      address_state: "Queensland",
      address_postcode: "",
      address_country: "Australia",
      billing_address: "17 Tarrawarrah Avenue\nTallai, Queensland",
      active: 1,
      is_individual: 0,
      badges: "",
      fax_number: "",
      tax_rate_uuid: "",
      billing_attention: "0",
      payment_terms: "COD",
      parent_company_uuid: "",
    },
  ]
) {
  for (const contact of contacts) {
    try {
      logger.info(`✅ Processing contact  ${JSON.stringify(contact, null, 2)}`);

      // Upsert Contact in hubspot
      const upsertContact = await upsertContactInHubspot(contact);
      logger.info(
        `✅ Upserted contact  ${JSON.stringify(upsertContact, null, 2)}`
      );
    } catch (error) {
      logger.error("❌ Error processing contact:", {
        status: error?.status,
        response: error.response?.data,
        method: error?.method,
        url: error?.config?.url,
        headers: error?.config?.headers,
      });
    }
  }
}
async function processBatchDealInHubspot(
  records = [
    {
      uuid: "16eea0d2-7076-41de-8b42-23c9929c04ab",
      active: 1,
      date: "2026-02-01 00:00:00",
      job_address: "35 Wigmore St,\nWillowbank QLD 4306",
      billing_address: "29 Willowbank Drive\nWillowbank QLD 4306",
      status: "Completed",
      quote_date: "0000-00-00 00:00:00",
      work_order_date: "2026-02-01 01:12:50",
      work_done_description: "",
      lng: 152.6862632,
      lat: -27.6595746,
      generated_job_id: "41339",
      completion_date: "2026-02-10 12:53:30",
      completion_actioned_by_uuid: "0e99fd57-6a69-4082-b99d-208b8c8c23bb",
      unsuccessful_date: "0000-00-00 00:00:00",
      payment_date: "2026-02-10 00:00:00",
      payment_method: "Xero",
      payment_amount: 340,
      payment_actioned_by_uuid: "687d86c1-43c4-444e-9a6a-1cd3ccba40fb",
      edit_date: "2026-02-11 06:11:17",
      geo_is_valid: 1,
      payment_note: "",
      ready_to_invoice: "1",
      ready_to_invoice_stamp: "2026-02-11 05:54:42",
      company_uuid: "8d947baa-5e0e-45d1-9241-1d92165358bb",
      geo_country: "Australia",
      geo_postcode: "4306",
      geo_state: "QLD",
      geo_city: "Willowbank",
      geo_street: "Wigmore Street",
      geo_number: "35",
      payment_processed: 1,
      payment_processed_stamp: "2026-02-11 05:56:45",
      payment_received: 1,
      payment_received_stamp: "2026-02-10 00:00:00",
      total_invoice_amount: "340.0000",
      job_is_scheduled_until_stamp: "2026-02-10 12:45:00",
      category_uuid: "fdbd659d-ab04-420f-bcee-1d06605b9e6b",
      queue_uuid: "",
      queue_expiry_date: "0000-00-00 00:00:00",
      badges:
        '["ad20f191-a7a7-4c66-ae12-1cd9fd761a2b","32c1bf36-c255-4d93-b7f7-22983fa496ab"]',
      invoice_sent: true,
      purchase_order_number: "",
      invoice_sent_stamp: "2026-02-10 12:53:36",
      queue_assigned_staff_uuid: "",
      quote_sent_stamp: "0000-00-00 00:00:00",
      quote_sent: false,
      customfield_application_number: "",
      customfield_lot: "0",
      customfield_plan: "",
      active_network_request_uuid: "",
      customfield_lead_source: "",
      customfield_xero_tracking_cat_1: "",
      customfield_xero_tracking_cat_2: "HSTP Service",
      related_knowledge_articles: false,
      job_description:
        "Quarterly service Feb  2026  - Confirmed.    \n \nLast service date - Nov   2025.    \n\nBILLING INFO\n\nAnnual 1/4 - $340 \n\nplandev@ipswich.qld.gov.au ",
      created_by_staff_uuid: "687d86c1-43c4-444e-9a6a-1cd3ccba40fb",
    },
  ]
) {
  for (const record of records) {
    try {
      logger.info(`✅ Processing Job  ${JSON.stringify(record, null, 2)}`);

      // Upsert Deal in hubspot
      const upsertDeal = await upsertDealInHubspot(record);
      logger.info(`✅ Upserted Deal  ${JSON.stringify(upsertDeal, null, 2)}`);
    } catch (error) {
      logger.error("❌ Error processing Job:", {
        status: error?.status,
        response: error.response?.data,
        method: error?.method,
        url: error?.config?.url,
        headers: error?.config?.headers,
      });
    }
  }
}
async function processBatchNoteInHubspot(
  records = [
    {
      uuid: "0049830c-60a4-426b-a91c-23b7001c8b0a",
      edit_by_staff_uuid: "4981eca6-f6d2-43aa-a1e6-20bb3dce008b",
      create_date: "2026-01-13 14:10:21",
      edit_date: "2026-01-13 14:10:21",
      active: 1,
      note: "System alarming on arrival, pump has failed. Replaced d25 with reefe 250.",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "72030075-36bd-4d42-924c-23b6cc64b8ad",
    },
  ]
) {
  for (const [record, index] of records) {
    try {
      logger.info(`✅ Processing Note  ${JSON.stringify(record, null, 2)}`);

      // Upsert Note in hubspot
      const upsertNote = await upsertNoteInHubspot(record);
      logger.info(`✅ Upserted Deal  ${JSON.stringify(upsertNote, null, 2)}`);
    } catch (error) {
      logger.error(`❌ Error processing Note:${record?.uuid}`, {
        status: error?.status,
        response: error.response?.data,
        method: error?.method,
        url: error?.config?.url,
        headers: error?.config?.headers,
      });
    }
  }
}

// async function* hubspotGenerator(endpoint) {
//   let after = null;
//   let pageCount = 0;
//   let totalProcessed = 0;
//   const startTime = Date.now();

//   try {
//     do {
//       // fetch a page
//       pageCount++;
//       const response = await hubspotExecutor(
//         async () => {
//           return await axiosInstance.get(endpoint, {
//             params: { after, limit: 100 },
//           });
//         },
//         { endpoint, page: pageCount }
//       );
//       const records = response.data?.results || [];
//       // const records = Array.isArray(data) ? data : [data];

//       totalProcessed += records.length;

//       // Calculate Stats
//       const elapsedSeconds = (Date.now() - startTime) / 1000;
//       const recordsPerSecond = (totalProcessed / elapsedSeconds).toFixed(2);

//       // Yield data + metadata for the consumer
//       yield {
//         records,
//         stats: {
//           page: pageCount,
//           totalProcessed,
//           recordsPerSecond,
//           elapsedSeconds: elapsedSeconds.toFixed(1),
//         },
//       };

//       after = response.data?.paging?.next?.after;

//       logger.info(`[Hubspot Progress] ${endpoint}`, {
//         page: pageCount,
//         processed: totalProcessed,
//         speed: `${recordsPerSecond} rec/sec`,
//       });
//     } while (after);
//   } catch (error) {
//     logger.error(`Stream interrupted at page ${pageCount}`, {
//       status: error.response?.status,
//       response: error.response?.data,
//       method: error.config?.method,
//       url: error.config?.url,
//       headers: error.config?.headers,
//     });
//     throw error;
//   }
// }

async function* hubspotGenerator(
  endpoint,
  {
    axiosInstance = getHSAxios(),
    executor = hubspotExecutor,
    log = logger,
  } = {}
) {
  let after = undefined;
  let pageCount = 0;
  let totalProcessed = 0;
  const startTime = Date.now();

  try {
    do {
      pageCount++;

      const response = await executor(
        async () => {
          return await axiosInstance.get(endpoint, {
            params: { limit: 100, after },
          });
        },
        { endpoint, page: pageCount }
      );

      const records = response.data?.results || [];

      totalProcessed += records.length;

      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const recordsPerSecond =
        elapsedSeconds > 0
          ? (totalProcessed / elapsedSeconds).toFixed(2)
          : "0.00";

      yield {
        records,
        stats: {
          page: pageCount,
          totalProcessed,
          recordsPerSecond,
          elapsedSeconds: elapsedSeconds.toFixed(1),
        },
      };

      after = response.data?.paging?.next?.after;

      // log.info(`[HubSpot Progress] ${endpoint}`, {
      //   page: pageCount,
      //   processed: totalProcessed,
      //   speed: `${recordsPerSecond} rec/sec`,
      // });
    } while (after);
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

// async function syncContact() {
//   try {
//     const contactStream = hubspotGenerator("/crm/v3/objects/contacts");

//     for await (const { records, stats } of contactStream) {
//       // 1. Process the batch (e.g., Save to DB)
//       // await processBatchInDatabase(records);

//       // logger.info(`Processing a batch of ${records.length} companies...`);
//       // logger.info(`Stats : ${JSON.stringify(stats, null, 2)}`);

//       logger.info(`[HubSpot Progress] `, {
//         page: stats.pageCount,
//         processed: stats.totalProcessed,
//         speed: `${stats.recordsPerSecond} rec/sec`,
//       });
//     }
//   } catch (error) {
//     logger.error(`❌ Error processing Contact in Batch`, {
//       status: error?.status,
//       response: error.response?.data,
//       method: error?.method,
//       url: error?.config?.url,
//       headers: error?.config?.headers,
//     });
//     logger.error(`error`, error);
//   }
// }
async function syncContact({ log = logger } = {}) {
  try {
    const contactStream = hubspotGenerator("/crm/v3/objects/contacts");

    for await (const { records, stats } of contactStream) {
      log.info(`Processing a batch of ${records.length} Contacts...`);
      log.info(`Stats: ${JSON.stringify(stats, null, 2)}`);
    }
  } catch (error) {
    log.error("❌ Error processing Contact in Batch", error);
  }
}
export {
  processBatchContactInHubspot,
  processBatchDealInHubspot,
  processBatchNoteInHubspot,
  syncContact,
  hubspotGenerator,
};
