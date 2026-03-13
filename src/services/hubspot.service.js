import {
  logger,
  contactMappingSM8ToHS,
  dealMappingSM8ToHS,
  activityMappingSM8ToHS,
  companyMappingSM8ToHS,
  contactProperties,
  dealProperties,
  companyProperties,
  getLastSyncTime,
  saveLastSyncTime,
} from "../index.js";
import { getHubspotClient, getHSAxios } from "../configs/hubspot.config.js";
import { hubspotExecutor, serviceM8Executor } from "../utils/executors.js";
import {
  searchInServiceM8,
  searchInServiceM8UsingCustomField,
  processBatchContactInServiceM8,
  JOB_CATEGORY_UUID,
  processBatchDealInServiceM8,
  processBatchCompanyInServiceM8,
} from "./serviceM8.service.js";

async function processDealContactAssociation(
  contactInfo = {},
  upsertDealId = null,
  inner_index,
  hs_client = getHubspotClient()
) {
  if (!contactInfo || !upsertDealId) {
    logger.warn(`Missing contactInfo or DealId`);
    return;
  }
  try {
    logger.info(
      `✅ Processing contact at index:${inner_index + 1} ${JSON.stringify(
        contactInfo
      )} | dealId ${upsertDealId}`
    );
    // const existingContact = await findContactInHubspot(contactInfo);
    // logger.info(`✅ Found existing contact ${JSON.stringify(existingContact)}`);
    const upsertContact = await upsertContactInHubspot({}, contactInfo);
    logger.info(`✅ upserted contact : ${JSON.stringify(upsertContact)}`);

    if (!upsertContact) {
      logger.info(
        `❌ No existing contact found for ${JSON.stringify(contactInfo)}`
      );

      return;
    }

    if (upsertContact?.id && upsertDealId) {
      const associate = await hs_client.associations.associate(
        "contact",
        upsertContact?.id,
        "deal",
        upsertDealId,
        "4",
        "HUBSPOT_DEFINED"
      );

      logger.info(
        `✅ Associate contact Id : ${
          upsertContact?.id
        } with deal Id ${upsertDealId}: ${JSON.stringify(associate)}`
      );
    }
  } catch (error) {
    logger.error(
      `❌ HubSpot Contact ${JSON.stringify(
        contactInfo
      )} failed to Associate to deal ${upsertDealId}:`,
      {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method,
      }
    );
  }
}

// First search based on phone number if 0 results search based on email
// If more than 1 result search based on phone and email if 0 results upsert based on first contact
// async function findContactInHubspot(contactInfo = {}) {
//   try {
//     const hs_client = getHubspotClient();

//     const rawPhone = contactInfo?.mobile ? contactInfo?.mobile : null;

//     // 1. Remove all spaces and non-digit characters
//     // let cleaned = rawPhone;
//     let cleaned = null;
//     cleaned = rawPhone.replace(/\D/g, "");

//     // 2. Replace leading '0' with '+61'
//     if (cleaned.startsWith("0")) {
//       cleaned = "+61" + cleaned.substring(1);
//     } else if (cleaned && !cleaned.startsWith("61")) {
//       // Optional: Add +61 if it's missing entirely
//       cleaned = "+61" + cleaned;
//     }

//     const filters = [
//       // Only include mobilephone if 'cleaned' has a value
//       cleaned
//         ? {
//             propertyName: "mobilephone",
//             operator: "EQ",
//             value: cleaned,
//           }
//         : null,

//       // Only include email if it exists
//       contactInfo?.email
//         ? {
//             propertyName: "email",
//             operator: "EQ",
//             value: contactInfo.email,
//           }
//         : null,
//     ].filter(Boolean); // This removes all the 'null' entries

//     // Map the valid filters into their own filterGroups (OR logic)
//     const filterGroups = filters.map((f) => ({ filters: [f] }));

//     let existingContact = null;

//     if (cleaned) {
//       // Search Contact by phone number
//       existingContact = await hs_client.contacts.searchContacts(filterGroups);
//     }

//     // Return the contact if its length is 1
//     if (existingContact?.results?.length >= 1) {
//       logger.info(
//         `existingContact found by mobilephone : ${JSON.stringify(
//           existingContact
//         )}`
//       );
//       return existingContact.results[0];
//     }

//     // Search by email if it has 0 result
//     if (existingContact?.results?.length === 0) {
//       logger.info(
//         `exisingContact found by phone is Zero switching to search by email`
//       );
//       return await hs_client.contacts.getContactByCustomField(
//         "email",
//         contactInfo.email
//       );
//       // logger.info(
//       //   `existingContact found by email: ${JSON.stringify(
//       //     existingContact,
//       //     null,
//       //     2
//       //   )}`
//       // );
//     }
//   } catch (error) {
//     logger.error("❌ Error finding  existing Contact in Hubspot", {
//       status: error?.status,
//       response: error.response?.data,
//       method: error?.method,
//       url: error?.config?.url,
//       headers: error?.config?.headers,
//       stack: error,
//     });

//     throw error;
//   }
// }
async function findContactInHubspot(contactInfo = {}) {
  try {
    const hs_client = getHubspotClient();

    // 1. Safely handle the phone number
    const rawPhone = contactInfo?.mobile || contactInfo?.phone || null;
    let cleaned = null;

    if (rawPhone) {
      // Only run replace if rawPhone is NOT null/undefined/empty
      cleaned = rawPhone.replace(/\D/g, "");

      if (cleaned.startsWith("0")) {
        cleaned = "+61" + cleaned.substring(1);
      } else if (cleaned && !cleaned.startsWith("61")) {
        cleaned = "+61" + cleaned;
      }
    }

    // 2. Only attempt phone search if we actually have a cleaned phone number
    let existingContact = { results: [] };

    if (cleaned) {
      const filterGroups = [
        {
          filters: [
            {
              propertyName: "mobilephone",
              operator: "EQ",
              value: cleaned,
            },
          ],
        },
      ];
      existingContact = await hs_client.contacts.searchContacts(filterGroups);
    }

    // 3. Logic for handling results
    if (existingContact?.results?.length === 1) {
      return existingContact.results[0];
    }

    // Search by phone AND email if multiple results found
    if (existingContact?.results?.length > 1 && contactInfo.email) {
      const filterGroups = [
        {
          filters: [
            { propertyName: "email", operator: "EQ", value: contactInfo.email },
            { propertyName: "mobilephone", operator: "EQ", value: cleaned },
          ],
        },
      ];
      existingContact = await hs_client.contacts.searchContacts(filterGroups);
      if (existingContact?.results?.length >= 1)
        return existingContact.results[0];
    }

    // 4. Fallback: Search by email if no phone match was found or phone was missing
    if (existingContact?.results?.length === 0 && contactInfo.email) {
      logger.info(
        `No phone match for ${contactInfo.email}, searching by email...`
      );
      return await hs_client.contacts.getContactByCustomField(
        "email",
        contactInfo.email
      );
    }

    return null; // No contact found
  } catch (error) {
    // ... your existing error logging
  }
}
// async function upsertContactInHubspot(record = {}, contactInfo = {}) {
//   try {
//     // Find contact if exist update else create contact, first search based on phone number then email
//     const hs_client = getHubspotClient();

//     const payload = contactMappingSM8ToHS(record, contactInfo);

//     // search contact based on phone number

//     // First search based on phone number if 0 results search based on email
//     // If more than 1 result search based on phone and email if 0 results upsert based on first contact

//     let existingContact = await findContactInHubspot(contactInfo);
//     // search contact based on phone number if not found search based on email

//     if (existingContact) {
//       try {
//         return await hs_client.contacts.updateContact(
//           existingContact?.id,
//           payload
//         );
//       } catch (error) {
//         logger.error("❌ HubSpot Contact failed to upsert:", {
//           status: error?.status,
//           errorMessage: error.response?.data?.message || "Unknown",
//           response: error.response?.data,
//           // method: error?.method,
//           // url: error?.config?.url,
//           // headers: error?.config?.headers,
//           // stack: error,
//         });

//         // logger.info(`Full error : ${JSON.stringify(error, null, 2)}`);
//         // throw error;
//       }
//     } else {
//       // create  contact
//       try {
//         return await hs_client.contacts.createContact(payload);
//       } catch (error) {
//         logger.error("❌ HubSpot Contact failed to upsert:", {
//           status: error?.status,
//           errorMessage: error?.response?.message || "Unknown",
//           // response: error.response?.data,
//           // method: error?.method,
//           // url: error?.config?.url,
//           // headers: error?.config?.headers,
//           httpError: error,
//         });
//         logger.info(`Full error : ${JSON.stringify(error, null, 2)}`);
//       }
//     }
//   } catch (error) {
//     logger.error("❌ HubSpot Contact failed to upsert:", {
//       status: error?.status,
//       errorMessage: error?.response?.message || "Unknown",
//       // response: error.response?.data,
//       // method: error?.method,
//       // url: error?.config?.url,
//       // headers: error?.config?.headers,
//       httpError: error,
//     });
//     throw error;
//   }
// }

async function upsertClientContactInHubspot(record = {}, contactInfo = {}) {
  try {
    const hs_client = getHubspotClient();
    const payload = contactMappingSM8ToHS(record, contactInfo);

    // search contact based on sourceid

    const existingContact = await hs_client.contacts.getContactByCustomField(
      "sourceid",
      record?.uuid
    );

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
    logger.error("❌ HubSpot CleintContact failed to upsert (outer catch):", {
      status: error?.response?.status,
      message: error?.response?.data?.message,
    });

    throw error;
  }
}

// async function upsertContactInHubspot(record = {}, contactInfo = {}) {
//   try {
//     const hs_client = getHubspotClient();
//     const payload = contactMappingSM8ToHS(record, contactInfo);

//     let existingContact = await findContactInHubspot(contactInfo);

//     const isEmailConflict = (error) => {
//       const message = error?.response?.data?.message || "";
//       return (
//         error?.response?.data?.category === "VALIDATION_ERROR" &&
//         message.includes("propertyName=email")
//       );
//     };

//     const removeEmailFromPayload = (originalPayload) => {
//       const cloned = {
//         ...originalPayload,
//         // properties: { ...originalPayload.properties },
//       };
//       delete cloned.email;
//       return cloned;
//     };

//     if (existingContact) {
//       try {
//         return await hs_client.contacts.updateContact(
//           existingContact.id,
//           payload
//         );
//       } catch (error) {
//         logger.error("❌ HubSpot Contact update failed:", {
//           status: error?.response?.status,
//           message: error?.response?.data?.message,
//           category: error?.response?.data?.category,
//         });

//         // 🔁 Retry without email if duplicate email conflict
//         if (isEmailConflict(error)) {
//           logger.warn(
//             "⚠️ Email conflict detected. Retrying update without email..."
//           );

//           const retryPayload = removeEmailFromPayload(payload);

//           return await hs_client.contacts.updateContact(
//             existingContact.id,
//             retryPayload
//           );
//         }

//         throw error; // don't swallow unknown errors
//       }
//     } else {
//       try {
//         return await hs_client.contacts.createContact(payload);
//       } catch (error) {
//         logger.error("❌ HubSpot Contact create failed:", {
//           status: error?.response?.status,
//           message: error?.response?.data?.message,
//           category: error?.response?.data?.category,
//         });

//         if (isEmailConflict(error)) {
//           logger.warn(
//             "⚠️ Email conflict detected. Retrying create without email..."
//           );

//           const retryPayload = removeEmailFromPayload(payload);

//           return await hs_client.contacts.createContact(retryPayload);
//         }

//         throw error;
//       }
//     }
//   } catch (error) {
//     logger.error("❌ HubSpot Contact failed to upsert (outer catch):", {
//       httpStatus: error?.status,
//       response: error?.response?.data,
//       method: error?.method,
//       url: error?.config?.url,
//       headers: error?.config?.headers,
//       message: error?.message,
//       stack: error?.stack,
//     });

//     throw error;
//   }
// }

async function upsertContactInHubspot(record = {}, contactInfo = {}) {
  try {
    const hs_client = getHubspotClient();
    const payload = contactMappingSM8ToHS(record, contactInfo);

    let existingContact = await findContactInHubspot(contactInfo);

    if (existingContact) {
      return await hs_client.contacts.updateContact(
        existingContact.id,
        payload
      );
    } else {
      return await hs_client.contacts.createContact(payload);
    }
  } catch (error) {
    logger.error("❌ HubSpot Contact failed to upsert (outer catch):", {
      httpStatus: error?.status,
      response: error?.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error?.message,
      stack: error?.stack,
    });

    throw error;
  }
}
async function upsertCompanyInHubspot(record, contactInfo) {
  try {
    // Find company if exist update else create company
    const hs_client = getHubspotClient();

    const payload = companyMappingSM8ToHS(record, contactInfo); //

    // search company based on sourceid
    const existingCompany = await hs_client.companies.getCompanyByCustomField(
      "sourceid",
      record?.uuid
    );

    if (existingCompany) {
      return await hs_client.companies.updateCompany(
        existingCompany?.id,
        payload
      );
    } else {
      // create  contact
      return await hs_client.companies.createCompany(payload);
    }
  } catch (error) {
    logger.error("❌ HubSpot Company failed to upsert:", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
    });
    throw error;
  }
}
async function upsertDealInHubspot(
  // record = {
  //   uuid: "16eea0d2-7076-41de-8b42-23c9929c04ab",
  //   active: 1,
  //   date: "2026-02-01 00:00:00",
  //   job_address: "35 Wigmore St,\nWillowbank QLD 4306",
  //   billing_address: "29 Willowbank Drive\nWillowbank QLD 4306",
  //   status: "Completed",
  //   quote_date: "0000-00-00 00:00:00",
  //   work_order_date: "2026-02-01 01:12:50",
  //   work_done_description: "",
  //   lng: 152.6862632,
  //   lat: -27.6595746,
  //   generated_job_id: "41339",
  //   completion_date: "2026-02-10 12:53:30",
  //   completion_actioned_by_uuid: "0e99fd57-6a69-4082-b99d-208b8c8c23bb",
  //   unsuccessful_date: "0000-00-00 00:00:00",
  //   payment_date: "2026-02-10 00:00:00",
  //   payment_method: "Xero",
  //   payment_amount: 340,
  //   payment_actioned_by_uuid: "687d86c1-43c4-444e-9a6a-1cd3ccba40fb",
  //   edit_date: "2026-02-11 06:11:17",
  //   geo_is_valid: 1,
  //   payment_note: "",
  //   ready_to_invoice: "1",
  //   ready_to_invoice_stamp: "2026-02-11 05:54:42",
  //   company_uuid: "8d947baa-5e0e-45d1-9241-1d92165358bb",
  //   geo_country: "Australia",
  //   geo_postcode: "4306",
  //   geo_state: "QLD",
  //   geo_city: "Willowbank",
  //   geo_street: "Wigmore Street",
  //   geo_number: "35",
  //   payment_processed: 1,
  //   payment_processed_stamp: "2026-02-11 05:56:45",
  //   payment_received: 1,
  //   payment_received_stamp: "2026-02-10 00:00:00",
  //   total_invoice_amount: "340.0000",
  //   job_is_scheduled_until_stamp: "2026-02-10 12:45:00",
  //   category_uuid: "fdbd659d-ab04-420f-bcee-1d06605b9e6b",
  //   queue_uuid: "",
  //   queue_expiry_date: "0000-00-00 00:00:00",
  //   badges:
  //     '["ad20f191-a7a7-4c66-ae12-1cd9fd761a2b","32c1bf36-c255-4d93-b7f7-22983fa496ab"]',
  //   invoice_sent: true,
  //   purchase_order_number: "",
  //   invoice_sent_stamp: "2026-02-10 12:53:36",
  //   queue_assigned_staff_uuid: "",
  //   quote_sent_stamp: "0000-00-00 00:00:00",
  //   quote_sent: false,
  //   customfield_application_number: "",
  //   customfield_lot: "0",
  //   customfield_plan: "",
  //   active_network_request_uuid: "",
  //   customfield_lead_source: "",
  //   customfield_xero_tracking_cat_1: "",
  //   customfield_xero_tracking_cat_2: "HSTP Service",
  //   related_knowledge_articles: false,
  //   job_description:
  //     "Quarterly service Feb  2026  - Confirmed.    \n \nLast service date - Nov   2025.    \n\nBILLING INFO\n\nAnnual 1/4 - $340 \n\nplandev@ipswich.qld.gov.au ",
  //   created_by_staff_uuid: "687d86c1-43c4-444e-9a6a-1cd3ccba40fb",
  // }
  record = {}
) {
  try {
    // Find deal if exist update else create deal
    const hs_client = getHubspotClient();

    const sourceid = record?.uuid;
    const payload = dealMappingSM8ToHS(record);

    logger.info(`[HUBSPOT DEAL] payload: ${JSON.stringify(payload, null, 2)}`);

    // search contact based on sourceid

    const existingDeal = await hs_client.deals.getDealByCustomField(
      "sourceid",
      sourceid
    );

    if (existingDeal) {
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
async function upsertActivityInHubspot(endpoint, record = {}) {
  try {
    // Find Notes if exist update else create deal
    const hs_client = getHubspotClient();

    const notes = hs_client.customObject(`${endpoint}`);

    // const sourceid = record?.uuid;
    // ❌ Create payload before testing and check if i only need to create notes (or update it also?)
    // const payload = {
    //   note: record?.note,
    //   sourceid: sourceid,
    // };
    const payload = activityMappingSM8ToHS(record);
    logger.info(`payload: ${JSON.stringify(payload, null, 2)}`);
    // search Note based on sourceid

    // const existingNote = await notes.getCustomObjectByCustomField(
    //   "sourceid",
    //   sourceid
    // );

    // if (existingNote) {
    //   logger.info(`Existing deal: ${JSON.stringify(existingNote, null, 2)}`);
    //   const result = await notes.update(existingNote?.id, payload);
    //   logger.info(`Created deal: ${JSON.stringify(result, null, 2)}`);

    //   // return await notes.update(existingNote?.id, payload);
    // } else {
    // create  contact
    return await notes.create(payload);
    // logger.info(`Created Activity: ${JSON.stringify(result, null, 2)}`);
    // return await notes.createContact(payload);
    // }
  } catch (error) {
    logger.error(`"❌ HubSpot Note failed to Create`, {
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
  records = [
    // {
    //   uuid: "9a4b098b-dc6b-4ab9-a452-1cd3ce1d04eb",
    //   edit_date: "2021-08-17 13:02:29",
    //   name: "Teresa Stanton",
    //   website: "",
    //   abn_number: "",
    //   address: "1 Tudor Court\nDelaneys Creek QLD 4514",
    //   address_street: "1 Tudor Court\nDelaneys Creek QLD 4514",
    //   address_city: "",
    //   address_state: "",
    //   address_postcode: "",
    //   address_country: "",
    //   billing_address: "1 Tudor Court\nDelaneys Creek QLD 4514",
    //   active: 1,
    //   is_individual: 1,
    //   badges: "",
    //   fax_number: "",
    //   tax_rate_uuid: "",
    //   billing_attention: "0",
    //   payment_terms: "",
    //   parent_company_uuid: "",
    // },
    // {
    //   uuid: "0041ab17-6f2d-41d6-b74e-238780c9733b",
    //   edit_date: "2025-11-27 09:39:23",
    //   name: "Arnold Broese",
    //   website: "",
    //   abn_number: "",
    //   address: "20 Mount Coolum Close\nMaroochy River QLD 4561",
    //   address_street: "20 Mount Coolum Close\nMaroochy River QLD 4561",
    //   address_city: "",
    //   address_state: "",
    //   address_postcode: "",
    //   address_country: "",
    //   billing_address: "20 Mount Coolum Close\nMaroochy River QLD 4561",
    //   active: 1,
    //   is_individual: 1,
    //   badges: '["32c1bf36-c255-4d93-b7f7-22983fa496ab"]',
    //   fax_number: "",
    //   tax_rate_uuid: "",
    //   billing_attention: "0",
    //   payment_terms: "",
    //   parent_company_uuid: "",
    // },
  ]
) {
  for (const record of records) {
    try {
      logger.info(`✅ Processing record  ${JSON.stringify(record, null, 2)}`);

      // Find contact if exist update else create contact, first search based on phone number then email

      const [upsertResult, contactInfoResult] = await Promise.allSettled([
        upsertClientContactInHubspot(record),
        searchInServiceM8UsingCustomField(
          "companycontact.json",
          "company_uuid",
          record?.uuid
        ),
      ]);

      if (upsertResult.status === "rejected") {
        logger.info(`❌ Error processing contact: ${upsertResult.reason}`);
        continue;
      }

      logger.info(
        `✅ Upserted Contact: ${JSON.stringify(upsertResult.value, null, 2)}`
      );

      const upsertContact = upsertResult.value;
      const contacts =
        contactInfoResult.status === "fulfilled" ? contactInfoResult.value : [];

      if (!contacts) {
        logger.warn(`Contact info not found for ${record?.uuid}`);
        return;
      }

      // upsert companycontact and associate to contact

      if (contacts.length > 0) {
        await processAssociatedCompanyContactsInHubspotWithContact(
          contacts,
          upsertContact?.id
        );
      }
    } catch (error) {
      logger.error(`❌ Error processing contact ${record?.uuid}:`, {
        status: error?.status,
        response: error.response?.data,
        method: error?.method,
        url: error?.config?.url,
        headers: error?.config?.headers,
        stack: error.stack,
      });
    }
  }
}
async function processBatchCompanyInHubspot(
  records = [
    {
      uuid: "9a54bcc5-a35d-4651-8948-1fb1c671ca4b",
      edit_date: "2026-03-05 22:43:58",
      name: "Tony and Sam Fischer",
      website: "",
      abn_number: "",
      address: "2 Lyndhurst Terrace,\nCaboolture QLD 4510",
      address_street: "",
      address_city: "",
      address_state: "",
      address_postcode: "",
      address_country: "",
      billing_address: "",
      active: 1,
      is_individual: 0,
      badges: "[]",
      fax_number: "",
      tax_rate_uuid: "",
      billing_attention: "0",
      payment_terms: "",
      parent_company_uuid: "",
    },
  ]
) {
  for (const record of records) {
    try {
      logger.info(`✅ Processing Company  ${JSON.stringify(record)}`);

      // fetch upsertcompany and fetch contact parallelly from serviceM8

      const [upsertCompanyResult, contactResult] = await Promise.allSettled([
        upsertCompanyInHubspot(record),
        searchInServiceM8UsingCustomField(
          "companycontact.json",
          "company_uuid",
          record?.uuid
        ),
      ]);

      // 3. Defensive Status Checking
      if (upsertCompanyResult.status === "rejected") {
        logger.error(
          `❌ Job upsert failed for ${record?.id}: ${upsertCompanyResult.reason}`
        );
        continue;
      }

      const upsertCompany = upsertCompanyResult.value;
      logger.info(`✅ Upserted Company  ${JSON.stringify(upsertCompany)}`);

      const contacts =
        contactResult.status === "fulfilled" ? contactResult.value : [];

      if (!contacts) {
        logger.warn(`Contact info not found for ${record?.uuid}`);
        continue;
      }

      // 4. Process Contacts (With individual error boundaries)
      if (contacts.length > 0) {
        await processAssociatedCompanyContactsInHubspot(
          contacts,
          upsertCompany?.id
        );
      }
    } catch (error) {
      logger.error("❌ Error processing Company:", {
        status: error?.status,
        response: error.response?.data,
        method: error?.method,
        url: error?.config?.url,
        headers: error?.config?.headers,
        stack: error.stack,
      });
    }
  }
}

async function processAssociatedCompanyContactsInHubspot(contacts, companyId) {
  const hs_client = getHubspotClient();
  return Promise.allSettled(
    contacts.map(async (contactInfo) => {
      try {
        // Find contact asociate with company
        if (!contactInfo.phone && !contactInfo.email) {
          logger.warn(
            `Phone and email is empty for ${
              contactInfo.uuid
            } : ${JSON.stringify(contactInfo)}`
          );
          return;
        }
        logger.info(`✅ Processing contact ${JSON.stringify(contactInfo)}`);

        const existingContact = await upsertContactInHubspot({}, contactInfo);

        logger.info(
          `✅ Upserted contact  ${JSON.stringify(existingContact, null, 2)}`
        );
        if (existingContact && existingContact?.id && companyId) {
          const associate = await hs_client.associations.associate(
            "contact",
            existingContact?.id,
            "company",
            companyId,
            "279",
            "HUBSPOT_DEFINED"
          );

          logger.info(
            `✅ Associate contact Id : ${
              existingContact?.id
            } with Company Id ${companyId}: ${JSON.stringify(
              associate,
              null,
              2
            )}`
          );
        }
      } catch (error) {
        logger.error("❌ Error processing contact:", {
          status: error?.status,
          response: error.response?.data,
          method: error?.method,
          url: error?.config?.url,
          headers: error?.config?.headers,
          stack: error?.stack,
        });
      }
    })
  );
}
/**
 * Process associated company contacts in Hubspot with a contact.
 * It takes a list of contacts and a contactId and upserts the contact in Hubspot.
 * If the contact is not found, it will upsert the contact in Hubspot.
 * It will then associate the contact with the contactId in Hubspot.
 * @param {Array} contacts - List of contacts
 * @param {String} contactId - ContactId to associate with
 * @returns {Promise} - Promise containing the result of the operation
 */
async function processAssociatedCompanyContactsInHubspotWithContact(
  contacts,
  contactId
) {
  const hs_client = getHubspotClient();
  return Promise.allSettled(
    contacts.map(async (contactInfo) => {
      try {
        // Find contact asociate with contact
        if (!contactInfo.mobile && !contactInfo.email) {
          logger.warn(
            `Phone and email is empty for ${
              contactInfo.uuid
            } : ${JSON.stringify(contactInfo)}`
          );
          return;
        }
        logger.info(`✅ Processing contact ${JSON.stringify(contactInfo)}`);

        let existingContact = null;

        // if (contactInfo.phone) {
        //   existingContact = await hs_client.contacts.getContactByCustomField(
        //     "phone",

        existingContact = await upsertContactInHubspot({}, contactInfo);

        logger.info(
          `✅ Upserted contact  ${JSON.stringify(existingContact, null, 2)}`
        );
        if (existingContact?.id && contactId) {
          const associate = await hs_client.associations.associate(
            "contact",
            existingContact?.id,
            "contact",
            contactId,
            "449",
            "HUBSPOT_DEFINED"
          );

          logger.info(
            `✅ Associate contact Id : ${
              existingContact?.id
            } with contact Id ${contactId}: ${JSON.stringify(
              associate,
              null,
              2
            )}`
          );
        }
      } catch (error) {
        logger.error("❌ Error processing contact:", {
          status: error?.status,
          response: error.response?.data,
          method: error?.method,
          url: error?.config?.url,
          headers: error?.config?.headers,
          stack: error,
        });
      }
    })
  );
}

// async function processBatchDealInHubspot(
//   records = [
//     {
//       uuid: "16eea0d2-7076-41de-8b42-23c9929c04ab",
//       active: 1,
//       date: "2026-02-01 00:00:00",
//       job_address: "35 Wigmore St,\nWillowbank QLD 4306",
//       billing_address: "29 Willowbank Drive\nWillowbank QLD 4306",
//       status: "Completed",
//       quote_date: "0000-00-00 00:00:00",
//       work_order_date: "2026-02-01 01:12:50",
//       work_done_description: "",
//       lng: 152.6862632,
//       lat: -27.6595746,
//       generated_job_id: "41339",
//       completion_date: "2026-02-10 12:53:30",
//       completion_actioned_by_uuid: "0e99fd57-6a69-4082-b99d-208b8c8c23bb",
//       unsuccessful_date: "0000-00-00 00:00:00",
//       payment_date: "2026-02-10 00:00:00",
//       payment_method: "Xero",
//       payment_amount: 340,
//       payment_actioned_by_uuid: "687d86c1-43c4-444e-9a6a-1cd3ccba40fb",
//       edit_date: "2026-02-11 06:11:17",
//       geo_is_valid: 1,
//       payment_note: "",
//       ready_to_invoice: "1",
//       ready_to_invoice_stamp: "2026-02-11 05:54:42",
//       company_uuid: "8d947baa-5e0e-45d1-9241-1d92165358bb",
//       geo_country: "Australia",
//       geo_postcode: "4306",
//       geo_state: "QLD",
//       geo_city: "Willowbank",
//       geo_street: "Wigmore Street",
//       geo_number: "35",
//       payment_processed: 1,
//       payment_processed_stamp: "2026-02-11 05:56:45",
//       payment_received: 1,
//       payment_received_stamp: "2026-02-10 00:00:00",
//       total_invoice_amount: "340.0000",
//       job_is_scheduled_until_stamp: "2026-02-10 12:45:00",
//       category_uuid: "fdbd659d-ab04-420f-bcee-1d06605b9e6b",
//       queue_uuid: "",
//       queue_expiry_date: "0000-00-00 00:00:00",
//       badges:
//         '["ad20f191-a7a7-4c66-ae12-1cd9fd761a2b","32c1bf36-c255-4d93-b7f7-22983fa496ab"]',
//       invoice_sent: true,
//       purchase_order_number: "",
//       invoice_sent_stamp: "2026-02-10 12:53:36",
//       queue_assigned_staff_uuid: "",
//       quote_sent_stamp: "0000-00-00 00:00:00",
//       quote_sent: false,
//       customfield_application_number: "",
//       customfield_lot: "0",
//       customfield_plan: "",
//       active_network_request_uuid: "",
//       customfield_lead_source: "",
//       customfield_xero_tracking_cat_1: "",
//       customfield_xero_tracking_cat_2: "HSTP Service",
//       related_knowledge_articles: false,
//       job_description:
//         "Quarterly service Feb  2026  - Confirmed.    \n \nLast service date - Nov   2025.    \n\nBILLING INFO\n\nAnnual 1/4 - $340 \n\nplandev@ipswich.qld.gov.au ",
//       created_by_staff_uuid: "687d86c1-43c4-444e-9a6a-1cd3ccba40fb",
//     },
//   ]
// ) {
//   console.time("BatchProcessingTimer");
//   for (const [index, record] of records.entries()) {
//     try {
//       logger.info(`✅ Processing Job  ${JSON.stringify(record, null, 2)}`);
//       // Use promise.allSettled api here for upserting and retrieving data

//       const [upsertResult, contactsResult] = await Promise.allSettled([
//         upsertDealInHubspot(record),
//         searchInServiceM8UsingCustomField(
//           "jobcontact.json",
//           "job_uuid",
//           record?.uuid
//         ),
//       ]);

//       const upsertDeal =
//         upsertResult.status === "fulfilled" ? upsertResult.value : null;
//       const contacts =
//         contactsResult.status === "fulfilled" ? contactsResult.value : null;

//       if (!upsertDeal?.id) {
//         logger.error(`❌ Skipped: Could not upsert Deal for ${record.uuid}`);
//         continue; // Don't stop the whole batch, just this record
//       }

//       logger.info(`✅ Upserted Deal: ${JSON.stringify(upsertDeal, null, 2)}`);

//       if (!contacts) {
//         logger.warn(`Contact info not found for ${record?.uuid}`);
//         continue;
//       }
//       logger.info(`✅ Found contacts: ${contacts?.length}`);

//       await Promise.allSettled(
//         contacts.map(async (contactInfo, inner_index) => {
//           try {
//             await processDealContactAssociation(
//               contactInfo,
//               upsertDeal?.id,
//               inner_index
//             );
//           } catch (error) {
//             logger.error(
//               `❌ Error processing contact at index:${
//                 inner_index + 1
//               } ${JSON.stringify(contactInfo, null, 2)}`,
//               {
//                 message: error.message,
//                 status: error.response?.status,
//                 data: error.response?.data,
//                 url: error.config?.url,
//                 method: error.config?.method,
//               }
//             );
//           }
//         })
//       );

//       // for (const [inner_index, contactInfo] of contacts.entries()) {
//       //   try {
//       //     logger.info(
//       //       `✅ Processing contact at index:${inner_index + 1} ${JSON.stringify(
//       //         contactInfo
//       //       )}`
//       //     );
//       //     let existingContact = null;

//       //     if (contactInfo.phone) {
//       //       existingContact = await hs_client.contacts.getContactByCustomField(
//       //         "phone",
//       //         contactInfo.phone
//       //       );
//       //       logger.info(
//       //         `existingContact found by phone: ${JSON.stringify(
//       //           existingContact,
//       //           null,
//       //           2
//       //         )}`
//       //       );
//       //     }

//       //     // if found assocaite with hubspot deal

//       //     if (!existingContact && contactInfo.email) {
//       //       existingContact = await hs_client.contacts.getContactByCustomField(
//       //         "email",
//       //         contactInfo.email
//       //       );
//       //       logger.info(
//       //         `existingContact found by email: ${JSON.stringify(
//       //           existingContact,
//       //           null,
//       //           2
//       //         )}`
//       //       );
//       //     }

//       //     if (existingContact?.id && upsertDeal?.id) {
//       //       const associate = await hs_client.associations.associate(
//       //         "contact",
//       //         existingContact?.id,
//       //         "deal",
//       //         upsertDeal?.id,
//       //         "4",
//       //         "HUBSPOT_DEFINED"
//       //       );

//       //       logger.info(
//       //         `✅ Associate contact Id : ${existingContact?.id} with deal Id ${
//       //           upsertDeal?.id
//       //         }: ${JSON.stringify(associate, null, 2)}`
//       //       );
//       //     }
//       //   } catch (error) {
//       //     logger.error(`❌ Error processing contact`, {
//       //       status: error?.status,
//       //       response: error.response?.data,
//       //       method: error?.method,
//       //       url: error?.config?.url,
//       //       headers: error?.config?.headers,
//       //       stack: error,
//       //     });
//       //   }
//       // }

//       console.timeEnd("BatchProcessingTimer");

//       // return; // TODO Remove after testing
//     } catch (error) {
//       logger.error("❌ Error processing Job:", {
//         status: error?.status,
//         response: error.response?.data,
//         method: error?.method,
//         url: error?.config?.url,
//         headers: error?.config?.headers,
//         stack: error,
//       });
//     }
//   }
// }

async function processBatchDealInHubspot(
  records = [
    // {
    //   uuid: "05a10154-0123-45bc-804a-2396df4e950d",
    //   active: 1,
    //   date: "2025-12-11 00:00:00",
    //   job_address: "412 Hemmant Tingalpa Rd\nHemmant QLD 4174",
    //   billing_address: "412 Hemmant Tingalpa Rd\nHemmant QLD 4174",
    //   status: "Completed",
    //   quote_date: "0000-00-00 00:00:00",
    //   work_order_date: "2025-12-11 15:37:49",
    //   work_done_description: "",
    //   lng: 153.1337208,
    //   lat: -27.461306,
    //   generated_job_id: "39399",
    //   completion_date: "2025-12-17 12:34:29",
    //   completion_actioned_by_uuid: "f48ba2fb-d1ac-4555-b0d9-2009faba39bb",
    //   unsuccessful_date: "0000-00-00 00:00:00",
    //   payment_date: "2025-12-18 00:00:00",
    //   payment_method: "Xero",
    //   payment_amount: 570,
    //   payment_actioned_by_uuid: "687d86c1-43c4-444e-9a6a-1cd3ccba40fb",
    //   edit_date: "2025-12-19 05:45:46",
    //   geo_is_valid: 1,
    //   payment_note: "",
    //   ready_to_invoice: "1",
    //   ready_to_invoice_stamp: "2025-12-18 05:57:35",
    //   company_uuid: "6a0dadab-f917-4a91-8038-2396dee63ebb",
    //   geo_country: "Australia",
    //   geo_postcode: "4174",
    //   geo_state: "QLD",
    //   geo_city: "Hemmant",
    //   geo_street: "Hemmant Tingalpa Road",
    //   geo_number: "412",
    //   payment_processed: 1,
    //   payment_processed_stamp: "2025-12-18 05:59:03",
    //   payment_received: 1,
    //   payment_received_stamp: "2025-12-18 00:00:00",
    //   total_invoice_amount: "570.0000",
    //   job_is_scheduled_until_stamp: "2025-12-17 08:00:00",
    //   category_uuid: "f4460be7-395d-42ca-a465-22f384e3a8fb",
    //   queue_uuid: "",
    //   queue_expiry_date: "0000-00-00 00:00:00",
    //   badges: "",
    //   invoice_sent: true,
    //   purchase_order_number: "",
    //   invoice_sent_stamp: "2025-12-17 12:33:30",
    //   queue_assigned_staff_uuid: "",
    //   quote_sent_stamp: "0000-00-00 00:00:00",
    //   quote_sent: false,
    //   customfield_application_number: "",
    //   customfield_lot: "0",
    //   customfield_plan: "",
    //   active_network_request_uuid: "",
    //   customfield_lead_source: "",
    //   customfield_xero_tracking_cat_1: "",
    //   customfield_xero_tracking_cat_2: "",
    //   related_knowledge_articles: false,
    //   job_description: "17 DEC - HARMOR TO PUMP OUT SEPTIC AND GREASE TRAP",
    //   created_by_staff_uuid: "f48ba2fb-d1ac-4555-b0d9-2009faba39bb",
    // },
    // {
    //   uuid: "021e5b1f-bb4b-497a-9f0b-22ec72ffdb4d",
    //   active: 1,
    //   date: "2025-06-24 00:00:00",
    //   job_address: "148 Thompson Road\nGreenbank QLD 4124",
    //   billing_address: "148 Thompson Road\nGreenbank QLD 4124",
    //   status: "Quote",
    //   quote_date: "2025-06-24 13:23:48",
    //   work_order_date: "0000-00-00 00:00:00",
    //   work_done_description: "",
    //   lng: 152.9584103,
    //   lat: -27.6984444,
    //   generated_job_id: "31464",
    //   completion_date: "0000-00-00 00:00:00",
    //   completion_actioned_by_uuid: "",
    //   unsuccessful_date: "0000-00-00 00:00:00",
    //   payment_date: "0000-00-00 00:00:00",
    //   payment_method: "",
    //   payment_amount: 0,
    //   payment_actioned_by_uuid: "",
    //   edit_date: "2025-07-15 14:17:38",
    //   geo_is_valid: 1,
    //   payment_note: "",
    //   ready_to_invoice: "0",
    //   ready_to_invoice_stamp: "0000-00-00 00:00:00",
    //   company_uuid: "2acf2b64-7fcf-4549-b16f-22ec73adc85b",
    //   geo_country: "Australia",
    //   geo_postcode: "4124",
    //   geo_state: "QLD",
    //   geo_city: "Greenbank",
    //   geo_street: "Thompson Road",
    //   geo_number: "148",
    //   payment_processed: 0,
    //   payment_processed_stamp: "0000-00-00 00:00:00",
    //   payment_received: 0,
    //   payment_received_stamp: "0000-00-00 00:00:00",
    //   total_invoice_amount: "28168.5500",
    //   job_is_scheduled_until_stamp: "2025-07-01 11:00:00",
    //   category_uuid: "6642ee12-d5ea-4e88-b081-1cd9fc0ef11b",
    //   queue_uuid: "",
    //   queue_expiry_date: "0000-00-00 00:00:00",
    //   badges: "",
    //   invoice_sent: false,
    //   purchase_order_number: "",
    //   invoice_sent_stamp: "0000-00-00 00:00:00",
    //   queue_assigned_staff_uuid: "",
    //   quote_sent_stamp: "2025-07-01 12:19:49",
    //   quote_sent: true,
    //   customfield_application_number: "",
    //   customfield_lot: "0",
    //   customfield_plan: "",
    //   active_network_request_uuid: "",
    //   customfield_lead_source: "",
    //   customfield_xero_tracking_cat_1: "",
    //   customfield_xero_tracking_cat_2: "",
    //   related_knowledge_articles: false,
    //   job_description:
    //     "Source - Google Rating (B)\nHas an old system that has mutliple issues. Would like a quote to replace.\nBooked for 2nd job around 10.30 ish ",
    //   created_by_staff_uuid: "2e65a790-64bc-4d05-892c-1cd9f69b454b",
    // },
    {
      uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
      active: 1,
      date: "2024-08-01 00:00:00",
      job_address: "252-258 Cedar Grove Road\nCedar Grove QLD 4285",
      billing_address: "252-258 Cedar Grove Road\nCedar Grove QLD 4285",
      status: "Completed",
      quote_date: "2024-08-01 10:06:31",
      work_order_date: "2024-08-13 18:51:45",
      work_done_description:
        "-Confirm if there is existing grass cover in proposed LAA\n-Take pictures of underground delivery line/pipework\n-Check any conditions on plans i.e diversion mounds etc \n-Put 2 x wastewater warning signs up in LAA \n-Test LAA\n-Set sprinkler plumes so as not to exceed 2m total plume if applicable\n-Take pictures of completed LAA\n-make sure customer is happy \n-make sure job is invoiced - contact Teresa to arrange \n-Installation complete",
      lng: 152.9756887,
      lat: -27.8609312,
      generated_job_id: "18243",
      completion_date: "2024-10-30 13:54:48",
      completion_actioned_by_uuid: "5f5b74fc-b4e7-4d25-9479-1cd9fb07c74b",
      unsuccessful_date: "0000-00-00 00:00:00",
      payment_date: "2024-10-30 00:00:00",
      payment_method: "Xero",
      payment_amount: 3500,
      payment_actioned_by_uuid: "687d86c1-43c4-444e-9a6a-1cd3ccba40fb",
      edit_date: "2026-01-23 08:14:09",
      geo_is_valid: 1,
      payment_note: "",
      ready_to_invoice: "1",
      ready_to_invoice_stamp: "2024-10-31 05:54:49",
      company_uuid: "a74a5bf9-72e7-457d-a137-21a50951bf3b",
      geo_country: "Australia",
      geo_postcode: "4285",
      geo_state: "QLD",
      geo_city: "Cedar Grove",
      geo_street: "Cedar Grove Road",
      geo_number: "252-258",
      payment_processed: 1,
      payment_processed_stamp: "2024-10-31 05:42:15",
      payment_received: 1,
      payment_received_stamp: "2024-10-30 00:00:00",
      total_invoice_amount: "3500.0000",
      job_is_scheduled_until_stamp: "2024-10-30 14:00:00",
      category_uuid: "6642ee12-d5ea-4e88-b081-1cd9fc0ef11b",
      queue_uuid: "",
      queue_expiry_date: "0000-00-00 00:00:00",
      badges:
        '["ca775ec4-b7f7-4ecf-83b3-1e36336c53fb","01c7a4c7-1502-4764-b7d4-1e3634a54fcb"]',
      invoice_sent: true,
      purchase_order_number: "",
      invoice_sent_stamp: "2024-10-30 13:55:03",
      queue_assigned_staff_uuid: "",
      quote_sent_stamp: "2024-08-05 11:54:09",
      quote_sent: true,
      customfield_application_number: "DA-317575",
      customfield_lot: "2",
      customfield_plan: "SP168506",
      active_network_request_uuid: "",
      customfield_lead_source: "",
      customfield_xero_tracking_cat_1: "",
      customfield_xero_tracking_cat_2: "",
      related_knowledge_articles: false,
      job_description:
        "LAA INSTALL ONLY BOOKED 30/10 - NOT CONNECTING THE SAND FILTER FOR NOW. SAND FILTER IS NOT PART OF THE CEA FOR THIS SYSTEM SHOULD NOT BE NEEDED. LAURA IS AWARE \n\n______________\nDATES \n24/10  - PRESITE COMPLETED NICK R \n30/10  - LAA INSTALL BOOKED WITH CUSTOMER \n\n______________\nINSTALL NOTES \nLAA upgrade only \nPermit attached \nStamped plans attached  \n\n______________\nPHONE NUMBERS\nCOAST2COAST - 3282 4341 \nJOPA - ?0417 714 898?\n\n______________\nCONTRACTOR BOOKINGS \n\nEXCAVATIONS - Coast2coast 3.5T pozi combo -BOOKED\nWednesday 30/10 \n\nSAND x 3m3 - JOPA\nBooked 8am Wednesday 30th October \n\nMATERIALS - Reece delivery booked 2pm Tuesday 29/10 \n\nINSPECTION - LAA booked PM Wednesday 30/10 \n\n",
      created_by_staff_uuid: "2e65a790-64bc-4d05-892c-1cd9f69b454b",
    },
  ]
) {
  // Start the timer for the entire batch execution
  console.time("BatchProcessingTimer");
  logger.info(`Records length : ${records.length}`);

  const filterRecords = records.filter(
    (record) => JOB_CATEGORY_UUID[record.category_uuid]
  );

  logger.info(`Filtered Records length : ${filterRecords.length}`);

  for (const [index, record] of filterRecords.entries()) {
    try {
      logger.info(
        `🚀 [${index + 1}/${records.length}] Processing Job: ${JSON.stringify(
          record,
          null,
          2
        )}`
      );

      // 1. upsert Deal and fetch Contacts in Parallel
      const [upsertResult, contactsResult] = await Promise.allSettled([
        upsertDealInHubspot(record),
        searchInServiceM8UsingCustomField(
          "jobcontact.json",
          "job_uuid",
          record?.uuid
        ),
      ]);

      if (upsertResult.status === "rejected") {
        logger.error(`❌ Skipped: Could not upsert Deal for ${record.uuid}`);
        continue;
      }

      const upsertDeal = upsertResult.value;
      const contacts =
        contactsResult.status === "fulfilled" ? contactsResult.value : [];

      // 2. Guard: Handle HubSpot Upsert Failure
      if (!upsertDeal?.id) {
        logger.error(`❌ Skipped: Could not upsert Deal for ${record.uuid}`);
        continue;
      }
      // logger.info(`✅ Upserted Deal: ${upsertDeal.id}`);
      logger.info(`✅ Upserted Deal: ${JSON.stringify(upsertDeal)}`);

      // 3. Guard: Handle Missing Contacts (Use CONTINUE, not return)
      if (!contacts || contacts.length === 0) {
        logger.warn(
          `⚠️ No contacts found for Job ${record.uuid}. skipping associations.`
        );
        continue;
      }
      logger.info(
        `🔍 Found ${contacts.length} contacts. Starting associations...`
      );

      // 4. Process all contacts for this specific job in parallel
      // We await this so the loop stays organized
      await Promise.allSettled(
        contacts.map((contactInfo, inner_index) =>
          processDealContactAssociation(contactInfo, upsertDeal.id, inner_index)
        )
      );
    } catch (error) {
      logger.error(`❌ Fatal error processing Job ${record.uuid}:`, {
        status: error?.status,
        response: error.response?.data,
        method: error?.method,
        url: error?.config?.url,
        headers: error?.config?.headers,
      });
    }
  }

  // End the timer after the loop finishes all records
  console.timeEnd("BatchProcessingTimer");
}
async function processBatchActivityInHubspot(
  records = [
    {
      uuid: "fb02f027-ad57-4791-8d90-21b1afc01f6b",
      edit_by_staff_uuid: "687d86c1-43c4-444e-9a6a-1cd3ccba40fb",
      create_date: "2024-08-13 18:51:45",
      edit_date: "2024-08-13 18:51:45",
      active: 1,
      note: "Express Wastewater Solutions Quote #18243 signed by Laura COOK",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "09de0f30-ff6e-4121-804a-21b28383af4b",
      edit_by_staff_uuid: "f4ab2d9f-c1be-48f3-b95b-1cd9f60c678b",
      create_date: "2024-08-15 07:46:27",
      edit_date: "2024-08-15 07:46:27",
      active: 1,
      note: "Partial invoice #18243A created for $770.00",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "409d723a-5930-43a3-bf26-21c12f2a6b0b",
      edit_by_staff_uuid: "12bc747b-35ef-43b2-9382-1cd3cacdd68b",
      create_date: "2024-08-30 07:23:45",
      edit_date: "2024-08-30 07:23:45",
      active: 1,
      note: "Customer wants late october for install at this stage",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "fc1f872d-12e3-4893-8f8e-21c12c1a54eb",
      edit_by_staff_uuid: "12bc747b-35ef-43b2-9382-1cd3cacdd68b",
      create_date: "2024-08-30 08:33:05",
      edit_date: "2024-08-30 08:33:05",
      active: 1,
      note: "won’t be home during g the week of 14 to 19 October",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "937c4b8f-1a07-4113-af7a-21d387060fda",
      edit_by_staff_uuid: "f4ab2d9f-c1be-48f3-b95b-1cd9f60c678b",
      create_date: "2024-09-17 08:02:50",
      edit_date: "2024-09-17 08:02:50",
      active: 1,
      note: "Plumbing approval is being held up due ti building envelope. Left msg with Laura, nick to ring council when they’re open",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "373a3c71-bd0e-472a-8375-21ef4335d68b",
      edit_by_staff_uuid: "12bc747b-35ef-43b2-9382-1cd3cacdd68b",
      create_date: "2024-10-15 09:53:55",
      edit_date: "2024-10-15 09:53:55",
      active: 1,
      note: "called Laura to discuss scheduling/pre-site etc. Left message",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "57719631-fee4-42cd-9228-21f3cacc6d8b",
      edit_by_staff_uuid: "12bc747b-35ef-43b2-9382-1cd3cacdd68b",
      create_date: "2024-10-18 13:58:43",
      edit_date: "2024-10-18 13:58:43",
      active: 1,
      note: "PREVIOUS JOB DESCRIPTION NOTES \n\nLead Qld Retrospective Building Approvals \n\nSecond dwelling possibly just a LAA upgrade \n\nBooked between 12 and 2",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "f4302f4c-3f31-4a7b-ae35-21f90505f26a",
      edit_by_staff_uuid: "5f5b74fc-b4e7-4d25-9479-1cd9fb07c74b",
      create_date: "2024-10-24 10:57:34",
      edit_date: "2024-10-24 10:57:34",
      active: 1,
      note: "100m Poly run \nParts to adapt from 32mm pressure to 25mm poly, tried to confirm if we are reconnecting sand filter (unable to confirm at this stage) \n3m3 sand required \nFew rocks on ground, ground maybe hard \nPM inspection recommended \nSufficient grass cover \n@peterskippen",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "82b280dd-6448-4d61-843e-21f9005c2aaa",
      edit_by_staff_uuid: "5f5b74fc-b4e7-4d25-9479-1cd9fb07c74b",
      create_date: "2024-10-24 11:09:58",
      edit_date: "2024-10-24 11:09:58",
      active: 1,
      note: "Spoke with Laura about sand filter, advised if incorrect flow or no working replacement would be required. Advised $1500 for replacement. Laura advised happy for us just to replace it on the day with a new one.",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "fec96f4a-aeba-491b-9745-21f90bf4c86a",
      edit_by_staff_uuid: "5f5b74fc-b4e7-4d25-9479-1cd9fb07c74b",
      create_date: "2024-10-24 11:12:05",
      edit_date: "2024-10-24 11:12:05",
      active: 1,
      note: "Parts required: \n32mm pressure elbow - 8 \n32mm x 40mm pressure reducer - 4 \n32mm faucet elbow - 1 \n32mm x 25mm poly bush - 1 \n25mm poly x 25mm male adapter \n25mm lilac poly HD - 2 \nIrrigation/sprinkler fittings",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "132b5b28-6879-4733-b7be-21f94a61c8ab",
      edit_by_staff_uuid: "12bc747b-35ef-43b2-9382-1cd3cacdd68b",
      create_date: "2024-10-24 14:23:55",
      edit_date: "2024-10-24 14:24:03",
      active: 1,
      note: "Called Logan, spoke to Taylor. Booked EDA pm Wednesday 30/10. Nick site contact ",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "3237de2f-c969-4c59-82ab-21f94b6440cb",
      edit_by_staff_uuid: "12bc747b-35ef-43b2-9382-1cd3cacdd68b",
      create_date: "2024-10-24 14:32:32",
      edit_date: "2024-10-24 14:32:32",
      active: 1,
      note: "Spoke to coast2coast, spoke to Skye and booked 3.5T combo with spreader bar",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "32d5122c-5b9f-48d0-9c8b-21fd33aa165b",
      edit_by_staff_uuid: "12bc747b-35ef-43b2-9382-1cd3cacdd68b",
      create_date: "2024-10-28 11:43:47",
      edit_date: "2024-10-28 11:43:47",
      active: 1,
      note: "Reece order placed",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "62cb029e-1da0-4b0d-97ef-21fd3a43ee1b",
      edit_by_staff_uuid: "12bc747b-35ef-43b2-9382-1cd3cacdd68b",
      create_date: "2024-10-28 14:50:49",
      edit_date: "2024-10-28 14:50:49",
      active: 1,
      note: "Spoke to Laura about the sand filter. shouldn't be needed as its not part of the CEA. We won't hook it up for now. Can do it if Council make us as a variation",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "a68b3c0c-1088-4624-a158-21feee2d817a",
      edit_by_staff_uuid: "5f5b74fc-b4e7-4d25-9479-1cd9fb07c74b",
      create_date: "2024-10-30 09:50:29",
      edit_date: "2024-10-30 09:59:40",
      active: 1,
      note: "Operator hours: 6:30 - 10:30\nMatt’s civil and haulage (Matt) - contact via coast to coast ",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "8038344b-8f1e-45e7-a5f2-21fee980cbfb",
      edit_by_staff_uuid: "12bc747b-35ef-43b2-9382-1cd3cacdd68b",
      create_date: "2024-10-30 09:56:24",
      edit_date: "2024-10-30 09:56:24",
      active: 1,
      note: "Excess fill put where customer wanted it along fenceline for future garden",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "beb03181-a9d2-4592-8b5b-22050d02194b",
      edit_by_staff_uuid: "12bc747b-35ef-43b2-9382-1cd3cacdd68b",
      create_date: "2024-11-05 15:55:14",
      edit_date: "2024-11-05 15:55:14",
      active: 1,
      note: "Spoke to Laura, advised the plumbing final inspection will take place after the second dwelling is all sorted",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "ee2ea7f8-e178-4c41-b415-22919ecada1b",
      edit_by_staff_uuid: "12bc747b-35ef-43b2-9382-1cd3cacdd68b",
      create_date: "2025-03-26 09:36:11",
      edit_date: "2025-03-26 09:36:11",
      active: 1,
      note: "Spoke to Nathan from Logan Council. no issue with action notice as this job is ongoing",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
    {
      uuid: "051d8685-b4a7-4ae1-a628-232bf0f2633b",
      edit_by_staff_uuid: "12bc747b-35ef-43b2-9382-1cd3cacdd68b",
      create_date: "2025-08-27 08:59:48",
      edit_date: "2025-08-27 08:59:48",
      active: 1,
      note: "Called Logan Council, spoke to Ben Saye. gave update.",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "022f69f3-1cf9-4a0d-8059-21a5012337bb",
    },
  ]
) {
  const hs_client = getHubspotClient();
  for (const record of records) {
    try {
      logger.info(`✅ Processing Note  ${JSON.stringify(record, null, 2)}`);

      // Upsert Note in hubspot
      const upsertNote = await upsertActivityInHubspot("notes", record);
      logger.info(
        `✅ Upserted Activity  ${JSON.stringify(upsertNote, null, 2)}`
      );

      // fetch contacts and deal then associate it.
      const relatedObject = record.related_object?.trim().toLowerCase();

      if (relatedObject == "company") {
        let contactId = null;

        // Search in hubspot contact/company
        let existingInHubspot = null;
        existingInHubspot = await searchInHubspot(
          "contacts",
          "sourceid",
          record.related_object_uuid
        );

        // if contact already exists in hubspot then use it
        if (existingInHubspot?.length > 0) {
          contactId = existingInHubspot[0]?.id;

          if (contactId && upsertNote?.id) {
            // Associate activity with contact
            const associate = await hs_client.associations.associate(
              "contacts",
              contactId,
              "notes",
              upsertNote?.id,
              "201",
              "HUBSPOT_DEFINED"
            );
            logger.info(
              `✅ Associate Note ${
                upsertNote?.id
              } with Contact ${contactId}  ${JSON.stringify(
                associate,
                null,
                2
              )}`
            );
          }
        }
        if (!existingInHubspot) {
          existingInHubspot = await searchInHubspot(
            "companies",
            "sourceid",
            record.related_object_uuid
          );
          if (existingInHubspot?.length > 0) {
            contactId = existingInHubspot[0]?.id;
            if (contactId && upsertNote?.id) {
              // Associate activity with contact
              const associate = await hs_client.associations.associate(
                "companies",
                contactId,
                "notes",
                upsertNote?.id,
                "189",
                "HUBSPOT_DEFINED"
              );
              logger.info(
                `✅ Associate Note ${
                  upsertNote?.id
                } with Company ${contactId}  ${JSON.stringify(
                  associate,
                  null,
                  2
                )}`
              );
            }
          }
        }

        if (!existingInHubspot) {
          // fetch client
          const company = await searchInServiceM8(
            "company.json",
            record.related_object_uuid
          );

          //if is_individual is 0 then it is company else it is contact
          // upsert contact
          let upsert = null;

          if (company.is_individual === 0) {
            upsert = await upsertCompanyInHubspot(company);
            logger.info(
              `✅ Upserted Company  ${JSON.stringify(upsert, null, 2)}`
            );
            contactId = upsert?.id;

            contactId = upsert?.id;

            if (contactId && upsertNote?.id) {
              // Associate activity with contact
              const associate = await hs_client.associations.associate(
                "companies",
                contactId,
                "notes",
                upsertNote?.id,
                "189",
                "HUBSPOT_DEFINED"
              );
              logger.info(
                `✅ Associate Note ${
                  upsertNote?.id
                } with Company ${contactId}  ${JSON.stringify(
                  associate,
                  null,
                  2
                )}`
              );
            }
          } else if (company.is_individual === 1) {
            upsert = await upsertClientContactInHubspot(company);
            logger.info(
              `✅ Upserted Contact  ${JSON.stringify(upsert, null, 2)}`
            );
            contactId = upsert?.id;

            if (contactId && upsertNote?.id) {
              // Associate activity with contact
              const associate = await hs_client.associations.associate(
                "contacts",
                contactId,
                "notes",
                upsertNote?.id,
                "201",
                "HUBSPOT_DEFINED"
              );
              logger.info(
                `✅ Associate Note ${
                  upsertNote?.id
                } with Contact ${contactId}  ${JSON.stringify(
                  associate,
                  null,
                  2
                )}`
              );
            }
          }
        }
      }
      if (relatedObject === "job") {
        let dealId = null;
        const existingDeal = await searchInHubspot(
          "deals",
          "sourceid",
          record.related_object_uuid
        );
        dealId = existingDeal[0]?.id;

        if (!existingDeal || existingDeal?.length > 0) {
          // fetch job
          const job = await searchInServiceM8(
            "job.json",
            record.related_object_uuid
          );
          // upsert deal
          const upsert = await upsertDealInHubspot(job);
          logger.info(`✅ Upserted Deal  ${JSON.stringify(upsert, null, 2)}`);
          dealId = upsert?.id;
        }

        if (dealId && upsertNote?.id) {
          // Associate activity with contact
          const associate = await hs_client.associations.associate(
            "deals",
            dealId,
            "notes",
            upsertNote?.id,
            "213",
            "HUBSPOT_DEFINED"
          );
          logger.info(
            `✅ Associate Note ${
              upsertNote?.id
            } with deal ${dealId}  ${JSON.stringify(associate, null, 2)}`
          );
        }
      }
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

/**
 * Generator function to stream records from Hubspot
 * @param {string} endpoint - The endpoint to stream records from
 * @param {Object} [options] - Optional parameters
 * @param {string[]} [options.properties] - The properties to fetch from Hubspot
 * @param {Object[]} [options.filterGroups] - The filter groups to apply to the stream
 * @param {import("axios").AxiosInstance} [options.axiosInstance] - The Axios instance to use for the stream
 * @param {function} [options.executor] - The executor function to use for the stream
 * @param {import("pino")} [options.log] - The logger to use for debugging
 * @returns {Generator<{records: Object[], stats: Object}>}
 */
async function* hubspotGenerator(
  endpoint,
  {
    properties = [],
    filterGroups = null,
    axiosInstance = getHSAxios(),
    executor = hubspotExecutor,
    log = logger,
  } = {}
) {
  let after = undefined;
  let pageCount = 0;
  let totalProcessed = 0;
  const startTime = Date.now();

  const isDelta = Array.isArray(filterGroups) && filterGroups.length > 0;

  try {
    do {
      pageCount++;

      const response = await executor(async () => {
        if (isDelta) {
          // 🔥 Use Search API for delta
          return axiosInstance.post(`${endpoint}/search`, {
            filterGroups,
            properties,
            limit: 100,
            after,
          });
        } else {
          // 🔹 Normal list mode
          return axiosInstance.get(endpoint, {
            params: {
              limit: 100,
              after,
              ...(properties.length && {
                properties: properties.join(","),
              }),
            },
          });
        }
      });

      const records = response.data?.results || [];
      totalProcessed += records.length;

      const elapsedSeconds = (Date.now() - startTime) / 1000;

      yield {
        records,
        stats: {
          page: pageCount,
          totalProcessed,
          recordsPerSecond:
            elapsedSeconds > 0
              ? (totalProcessed / elapsedSeconds).toFixed(2)
              : "0.00",
        },
      };

      after = response.data?.paging?.next?.after;
    } while (after);
  } catch (error) {
    log.error("HubSpot Stream Error", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
}

async function searchInHubspot(
  endpoint,
  propertyName,
  propertyValue,
  axiosInstance = getHSAxios()
) {
  try {
    const url = `/crm/v3/objects/${endpoint}/search`;
    const filterGroups = [
      {
        filters: [
          {
            propertyName: propertyName,
            operator: "EQ",
            value: propertyValue,
          },
        ],
      },
    ];
    const response = await axiosInstance.post(url, {
      filterGroups,
      params: { limit: 1, after: "" },
    });
    const records = response.data?.results || null;
    // logger.info(`Search Result: ${JSON.stringify(records, null, 2)}`);
    return records;
  } catch (error) {
    logger.error("❌ Error processing Search in Hubspot", {
      httpStatus: error?.status,
      response: error?.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error?.message,
      stack: error?.stack,
    });
    throw error;
  }
}

// ✅ Fetch deal from hubspot and sync to serviceM8 as Job, Job will be only one way sync from HS-SM8
async function syncHubspotDealToServiceM8Job() {
  try {
    const lastSyncISO = getLastSyncTime();
    const lastSyncMillis = new Date(lastSyncISO).getTime().toString();

    const endpoint = "/crm/v3/objects/deals";
    const filterGroups = [
      {
        filters: [
          {
            propertyName: "hs_lastmodifieddate",
            operator: "GT",
            value: lastSyncMillis,
          },
        ],
      },
    ];
    // const properties = dealProperties();
    logger.info(
      `[HubSpot] Last Sync Time: ${lastSyncISO}, Epoch: ${lastSyncMillis} and endPoint ${endpoint}`
    );
    const dealStream = hubspotGenerator(endpoint, {
      properties: dealProperties(),
      filterGroups,
    });

    for await (const { records, stats } of dealStream) {
      await processBatchDealInServiceM8(records);
      logger.info(`[ServiceM8 Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
    }
  } catch (error) {
    logger.error("❌ Error processing Deal in Batch", {
      httpStatus: error?.status,
      message: error.message,
      data: error.response?.data,
      url: error.config?.url,
      headers: error.config?.headers,
      method: error.config?.method,
      config: error.config,
      stack: error,
    });
  }
}
// ✅ Fetch Contact from hubspot and sync to serviceM8 as Client
async function syncHubspotContactToServiceM8Client() {
  try {
    const lastSyncISO = getLastSyncTime();
    const lastSyncMillis = new Date(lastSyncISO).getTime().toString();
    const endpoint = "/crm/v3/objects/contacts";

    const filterGroups = [
      {
        filters: [
          {
            propertyName: "lastmodifieddate",
            operator: "GT",
            value: lastSyncMillis,
          },
        ],
      },
    ];
    logger.info(
      `[HubSpot] Last Sync Time: ${lastSyncISO}, Epoch: ${lastSyncMillis} and endPoint ${endpoint}`
    );

    const contactStream = hubspotGenerator(endpoint, {
      properties: contactProperties(),
      filterGroups,
    });

    for await (const { records, stats } of contactStream) {
      await processBatchContactInServiceM8(records);
      logger.info(`[ServiceM8 Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
    }
  } catch (error) {
    logger.error("❌ Error processing Contacts in Batch", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error.message,
    });
  }
}
// ✅ Fetch company from hubspot and sync to serviceM8 as company(client)
async function syncHubspotCompanyToServiceM8Client() {
  try {
    // const lastSyncTime = "2026-02-14T10:00:00.000Z";
    // lastSyncTime = getLastSyncTime();
    // 1. Get the last sync time and convert to Epoch Milliseconds for HubSpot Search API
    const lastSyncISO = getLastSyncTime();
    const lastSyncMillis = new Date(lastSyncISO).getTime().toString();
    const endpoint = "/crm/v3/objects/companies";

    logger.info(
      `[HubSpot] Last Sync Time: ${lastSyncISO}, Epoch: ${lastSyncMillis}`
    );

    const filterGroups = [
      {
        filters: [
          {
            propertyName: "hs_lastmodifieddate",
            operator: "GT",
            value: lastSyncMillis,
          },
        ],
      },
    ];

    const contactStream = hubspotGenerator(endpoint, {
      properties: companyProperties(),
      filterGroups,
    });

    // const contactStream = hubspotGenerator(endpoint, properties, filterGroups);

    for await (const { records, stats } of contactStream) {
      // await processBatchCompanyInServiceM8(records);
      logger.info(`[ServiceM8 Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
    }
  } catch (error) {
    logger.error(
      "❌ Error processing Companies in syncHubspotCompanyToServiceM8Client",
      {
        status: error?.status,
        response: error.response?.data,
        method: error?.method,
        url: error?.config?.url,
        headers: error?.config?.headers,
        message: error.message,
      }
    );
  }
}

async function fetchHubSpotAssociationIds(
  fromObject = "companies",
  toObject = "contacts",
  objectId
) {
  if (!fromObject || !toObject || !objectId) {
    logger.warn(
      `Missing fromObject or toObject or objectId fromObject:${fromObject}, toObject:${toObject}, objectId:${objectId}`
    );
    return null;
  }
  let associatedIds = [];
  try {
    // fetch associated ids from hubspot
    const endpoint = `/crm/v3/objects/${fromObject}/${objectId}/associations/${toObject}`;
    const client = getHSAxios();
    const response = await client.get(endpoint);

    const results = response.data?.results || [];

    associatedIds = results.reduce((acc, item) => {
      acc.push(item.id);
      return acc;
    }, []);

    // logger.info(
    //   `[Hubspot] ${endpoint} : ${JSON.stringify(associatedIds, null, 2)}`
    // );

    return associatedIds || [];
  } catch (error) {
    logger.error(`❌ Error processing search in Hubspot:getAssociatedIds`, {
      httpStatus: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error.message,
    });
  }
}
async function fetchHubSpotObject(object, objectId, properties) {
  if (!object || !objectId) {
    logger.warn(
      `Missing object or objectId | object:${object}, objectId:${objectId}`
    );
    return null;
  }
  try {
    // fetch object from hubspot
    const endpoint = `/crm/v3/objects/${object}/${objectId}`;
    const client = getHSAxios();
    const response = await client.get(endpoint, {
      params: {
        properties,
      },
    });

    return response?.data || null;
  } catch (error) {
    logger.error(`❌ Error processing search in Hubspot:fetchHubSpotObject`, {
      httpStatus: error?.status,
      response: error?.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error?.message,
      stack: error?.stack,
    });
  }
}

/*!SECTION
● Cleaning checklist
● Safety checklist
● Preset technician checklist
● Routine completion steps
*/
/**
 * RESILIENT TASK FILTER
 * Excludes standard templates and noise while capturing all operational tasks.
 */
function filterTechnicianAddedTasks(records = []) {
  // 1. Define the specific "Blacklist" from the SOW [cite: 35-39]
  const excludedSections = [
    "Cleaning checklist",
    "Safety checklist",
    "Preset technician checklist",
    "Routine completion steps",
  ];

  return records.filter((record) => {
    // A. RULE: Must be an active record
    // if (record.active !== 1) return false;

    // B. RULE: Exclude the specific noise-heavy sections mentioned in SOW [cite: 41]
    if (excludedSections.includes(record.section_name)) return false;

    // C. RULE: Sync only actual "Task" types [cite: 43]
    // This prevents syncing photos (like your sample), headers, or checklists.
    // const isActualTask = record.item_type === "Task";

    // D. RULE: Ensure it has content (the 'name' field holds the instruction)
    const hasInstruction = record.name && record.name.trim().length > 0;

    return hasInstruction;
    // return isActualTask && hasInstruction;
  });
}
async function processBatchTasksInHubspot(taskRecords = []) {
  try {
    const records = filterTechnicianAddedTasks(taskRecords);

    if (records && records.length > 0) {
      logger.info(`Processing a batch of ${records.length} tasks...`);
      logger.info(`Record : ${JSON.stringify(records[0], null, 2)}`);
    }

    for (const record of records) {
      try {
        // Upsert task with idempotency
      } catch (error) {
        logger.error(
          `❌ Error processing search in Hubspot:processBatchTasksInHubspot`,
          {
            status: error?.status,
            response: error?.response?.data,
            method: error?.method,
            url: error?.config?.url,
            headers: error?.config?.headers,
            message: error?.message,
            stack: error?.stack || error,
          }
        );
      }
    }

    return;
  } catch (err) {
    logger.error(
      `❌ Error processing search in Hubspot:processBatchTasksInHubspot`,
      {
        status: err?.status,
        response: err?.response?.data,
        method: err?.method,
        url: err?.config?.url,
        headers: err?.config?.headers,
        message: err?.message,
        stack: err?.stack || err,
      }
    );
  }
}
export {
  fetchHubSpotObject,
  fetchHubSpotAssociationIds,
  processBatchContactInHubspot,
  processBatchDealInHubspot,
  processBatchActivityInHubspot,
  processBatchTasksInHubspot,
  hubspotGenerator,
  searchInHubspot,
  processBatchCompanyInHubspot,
  findContactInHubspot,
  // ✅ Fetch deal from hubspot and sync to serviceM8 as Job, Job will be only one way sync from HS-SM8
  syncHubspotDealToServiceM8Job,
  // ✅ Fetch Contact from hubspot and sync to serviceM8 as Client
  syncHubspotContactToServiceM8Client,
  // ✅ Fetch company from hubspot and sync to serviceM8 as company(client)
  syncHubspotCompanyToServiceM8Client,
};
