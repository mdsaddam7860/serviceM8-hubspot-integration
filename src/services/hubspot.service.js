// ------------------------index.js----------------------------------
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
  taskMappingSM8ToHS,
  needsUpdate,
  taskProperties,
  PIPELINE_CATEGORY,
} from "../index.js";
import { getHubspotClient, getHSAxios } from "../configs/hubspot.config.js";
import { hubspotExecutor, serviceM8Executor } from "../utils/executors.js";
import {
  searchInServiceM8,
  searchInServiceM8UsingCustomField,
  processBatchContactInServiceM8,
  JOB_CATEGORY_UUID,
  SECURITY_ROLES,
  processBatchDealInServiceM8,
  processBatchCompanyInServiceM8,
} from "./serviceM8.service.js";

import { taskClient } from "../utils/helper.util.js";

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
        httpStatus: error?.status,
        response: error?.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error?.message,
        stack: error?.stack || error,
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
      httpStatus: error?.status,
      response: error?.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error?.message,
      stack: error?.stack || error,
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

    let existingContact = null;
    if (contactInfo) {
      existingContact = await findContactInHubspot(contactInfo);
    }

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
      message: error?.message,
      stack: error?.stack || error,
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
      httpStatus: error?.status,
      response: error?.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error?.message,
      stack: error?.stack || error,
    });
    throw error;
  }
}
async function upsertDealInHubspot(record) {
  if (!record) {
    logger.warn(`Missing Record to sync to Hubspot`);
    return;
  }
  try {
    // Find deal if exist update else create deal
    const hs_client = getHubspotClient();

    const payload = dealMappingSM8ToHS(record);

    logger.info(
      `[HUBSPOT DEAL] payload: ${JSON.stringify(
        payload,
        null,
        2
      )}\n Record : ${JSON.stringify(record, null, 2)}`
    );

    // search contact based on sourceid

    let existingDeal = null;
    const properties = dealProperties();

    if (record?.uuid) {
      existingDeal = await hs_client.deals.getDealByCustomField(
        "job_uuid_service_m8",
        record?.uuid,
        properties
      );
    }

    if (existingDeal) {
      logger.info(`[HUBSPOT DEAL] Deal already exists: ${existingDeal.id}`);

      // Check if an update is actually necessary
      if (needsUpdate(payload, existingDeal)) {
        logger.info(
          `[HUBSPOT DEAL] Proceeding with update for Deal ID: ${existingDeal.id}`
        );
        return await hs_client.deals.updateDeal(existingDeal?.id, payload);
      } else {
        logger.info(
          `[HUBSPOT DEAL] Idempotency Check: No changes detected. Skipping update.`
        );
        return existingDeal; // Return the existing record without API call
      }
    } else {
      // create  Deal
      return await hs_client.deals.createDeal(payload);
    }
  } catch (error) {
    logger.error("❌ HubSpot Deal failed to upsert:", {
      httpStatus: error?.status,
      response: error?.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error?.message,
      stack: error?.stack || error,
    });

    throw error;
  }
}
async function upsertActivityInHubspot(endpoint, record = {}) {
  try {
    // Find Notes if exist update else create deal
    const hs_client = getHubspotClient();

    const notes = hs_client.customObject(`${endpoint}`);

    const payload = activityMappingSM8ToHS(record);
    logger.info(`payload: ${JSON.stringify(payload, null, 2)}`);
    // search note in hubspot

    // let properties = noteProperties();

    // search Note based on servicem8_uuid

    const existingNote = await notes.getCustomObjectByCustomField(
      "servicem8_uuid",
      record?.uuid
      // properties
    );

    if (existingNote) {
      logger.info(`Existing Note: ${JSON.stringify(existingNote, null, 2)}`);

      return await notes.update(existingNote?.id, payload);
    } else {
      // create  contact
      return await notes.create(payload);
    }
  } catch (error) {
    logger.error(`"❌ HubSpot Note failed to Create`, {
      httpStatus: error?.status,
      response: error?.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error?.message,
      stack: error?.stack || error,
    });
    throw error;
  }
}
async function processBatchContactInHubspot(records = []) {
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
        httpStatus: error?.status,
        response: error?.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error?.message,
        stack: error?.stack || error,
      });
    }
  }
}
async function processBatchCompanyInHubspot(records = []) {
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
        httpStatus: error?.status,
        response: error?.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error?.message,
        stack: error?.stack || error,
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
          httpStatus: error?.status,
          response: error?.response?.data,
          method: error?.method,
          url: error?.config?.url,
          message: error?.message,
          stack: error?.stack || error,
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
          httpStatus: error?.status,
          response: error?.response?.data,
          method: error?.method,
          url: error?.config?.url,
          message: error?.message,
          stack: error?.stack || error,
        });
      }
    })
  );
}

async function processBatchDealInHubspot(records = []) {
  // Start the timer for the entire batch execution
  logger.info(`Records length : ${records.length}`);

  const filterRecords = records.filter(
    (record) => JOB_CATEGORY_UUID[record.category_uuid]
  );

  logger.info(`Filtered Records length : ${filterRecords.length}`);

  for (const [index, record] of filterRecords.entries()) {
    try {
      // check for pipeline if exists then process otherwise skip
      await processSingleDealInHubspot(record, index, filterRecords.length);
    } catch (error) {
      logger.error(`❌ Fatal error processing Job ${record.uuid}:`, {
        httpStatus: error?.status,
        response: error?.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error?.message,
        stack: error?.stack || error,
      });
    }
  }
}

async function processSingleDealInHubspot(record, index, recordSize) {
  try {
    if (!PIPELINE_CATEGORY[record?.category_uuid]) {
      logger.info(
        `[${index + 1}/${recordSize}] Skipping Job: ${JSON.stringify(
          record
        )} | pipeline Category not found: ${record?.category_uuid} `
      );
      return;
    }
    logger.info(
      `🚀 [${index + 1}/${recordSize}] Processing Job: ${JSON.stringify(
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
      logger.error(` Skipped: Could not upsert Deal for ${record.uuid}`);
      return null;
    }

    const upsertDeal = upsertResult.value;
    const contacts =
      contactsResult.status === "fulfilled" ? contactsResult.value : [];

    // 2. Guard: Handle HubSpot Upsert Failure
    if (!upsertDeal?.id) {
      logger.error(` Skipped: Could not upsert Deal for ${record.uuid}`);
      return null;
    }
    // logger.info(` Upserted Deal: ${upsertDeal.id}`);
    logger.info(` Upserted Deal: ${JSON.stringify(upsertDeal)}`);

    // 3. Guard: Handle Missing Contacts (Use CONTINUE, not return)
    if (!contacts || contacts.length === 0) {
      logger.warn(
        `⚠️ No contacts found for Job ${record.uuid}. skipping associations.`
      );
      return upsertDeal;
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

    return upsertDeal;
  } catch (error) {
    logger.error(`❌ Fatal error processing Deal ${record.uuid}:`, {
      httpStatus: error?.status,
      response: error?.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error?.message,
      stack: error?.stack || error,
    });
  }
}
async function processBatchActivityInHubspot(records = []) {
  const hs_client = getHubspotClient();
  for (const record of records) {
    try {
      logger.info(
        `[ServiceM8] Processing Note  ${JSON.stringify(record, null, 2)}`
      );

      // Upsert Note in hubspot
      const upsertNote = await upsertActivityInHubspot("notes", record);
      logger.info(
        `[hubspot] Upserted Note  ${JSON.stringify(upsertNote, null, 2)}`
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
          "job_uuid_service_m8",
          record.related_object_uuid
        );
        dealId = existingDeal[0]?.id;

        if (!existingDeal) {
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
        httpStatus: error?.status,
        response: error?.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error?.message,
        stack: error?.stack || error,
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
 * @param {import("winston")} [options.log] - The logger to use for debugging
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
      message: error?.message,
      stack: error?.stack || error,
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
    logger.info(`[Hubspot] Generator Completed for ${endpoint}`);
  } catch (error) {
    logger.error("❌ Error processing Deal in Batch", {
      httpStatus: error?.status,
      response: error?.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error?.message,
      stack: error?.stack || error,
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
    logger.info(`[Hubspot] Generator Completed for ${endpoint}`);
  } catch (error) {
    logger.error("❌ Error processing Contacts in Batch", {
      httpStatus: error?.status,
      response: error?.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error?.message,
      stack: error?.stack || error,
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
    logger.info(`[Hubspot] Generator Completed for ${endpoint}`);
  } catch (error) {
    logger.error(
      "❌ Error processing Companies in syncHubspotCompanyToServiceM8Client",
      {
        httpStatus: error?.status,
        response: error?.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error?.message,
        stack: error?.stack || error,
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
      response: error?.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error?.message,
      stack: error?.stack || error,
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
      message: error?.message,
      stack: error?.stack || error,
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
    if (!record.section_name || !record.assigned_by_staff_uuid) return false;

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
async function processBatchTasksInHubspot(
  taskRecords = [
    // {
    //   edit_date: "2025-08-07 20:38:07",
    //   active: 1,
    //   job_uuid: "c255f31c-87e5-46d8-b358-231841e4162b",
    //   name: "Take photo of chlorine chute being topped up",
    //   item_type: "Photo",
    //   sort_order: 5010,
    //   completed_timestamp: "0000-00-00 00:00:00",
    //   completed_by_staff_uuid: "",
    //   completed_during_checkin_uuid: "",
    //   section_name: "Photos",
    //   regarding_object: "",
    //   regarding_object_uuid: "",
    //   fulfilled_by_object_name: "",
    //   fulfilled_by_object_uuid: "",
    //   is_locked: "0",
    //   reminder_type: "",
    //   assigned_by_staff_uuid: "",
    //   assigned_timestamp: "0000-00-00 00:00:00",
    //   uuid: "0000053e-a79a-47c8-9bba-231848439eab",
    //   reminder_data: [],
    //   assigned_to_staff_uuids: false,
    // },
    {
      edit_date: "2026-03-18 16:44:27",
      active: 1,
      job_uuid: "e643d1ae-a831-455e-a2ad-23e938f4be3b",
      name: "***Ericka please send a quote for electrician to attend and replace air pressure switch in Aqua Nova",
      item_type: "Todo",
      sort_order: 7020,
      completed_timestamp: "2026-03-16 17:43:43",
      completed_by_staff_uuid: "f48ba2fb-d1ac-4555-b0d9-2009faba39bb",
      completed_during_checkin_uuid: "",
      section_name: "After Service Checklist",
      regarding_object: "",
      regarding_object_uuid: "",
      fulfilled_by_object_name: "",
      fulfilled_by_object_uuid: "",
      is_locked: "0",
      reminder_type: "ABSOLUTE_DATETIME",
      assigned_by_staff_uuid: "b1fe7e3b-7859-4d2c-9159-1fd12891dd3b",
      assigned_timestamp: "2026-03-13 12:13:17",
      uuid: "c00531db-f9b0-41c1-81de-23f20e47ce9a",
      reminder_data: {
        absoluteDateTime: "2026-03-23 06:00:00",
      },
      assigned_to_staff_uuids: ["b1fe7e3b-7859-4d2c-9159-1fd12891dd3b"],
    },
  ]
) {
  try {
    const records = filterTechnicianAddedTasks(taskRecords);

    if (!records || records.length === 0) return null; // No tasks to process
    logger.info(`Processing a batch of ${records.length} tasks...`);

    const client = getHubspotClient();

    for (const record of records) {
      try {
        logger.info(
          `[ServiceM8] Processing Task : ${JSON.stringify(record, null, 2)}`
        );

        // only sync task that belongs to user where user(staff) role is “Service Technician" or Contractor

        const staffRecord = await searchInServiceM8(
          "staff.json",
          record.assigned_by_staff_uuid
        );

        // logger.info(
        //   `[ServiceM8] Staff : ${JSON.stringify(staffRecord, null, 2)}`
        // );

        if (!staffRecord.security_role_uuid) {
          logger.info(
            `[ServiceM8] No security role found for staff: ${record.assigned_by_staff_uuid}`
          );
          continue;
        }

        if (SECURITY_ROLES[staffRecord?.security_role_uuid]) {
          await processSingleTasksInHubspot(record, client);
        }
      } catch (error) {
        logger.error(
          `❌ Error processing search in Hubspot:processBatchTasksInHubspot`,
          {
            httpStatus: error?.status,
            response: error?.response?.data,
            method: error?.method,
            url: error?.config?.url,
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
        httpStatus: error?.status,
        response: error?.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error?.message,
        stack: error?.stack || error,
      }
    );
  }
}

async function processSingleTasksInHubspot(record, client) {
  try {
    const [upsertTaskResult, fetchJobResult] = await Promise.allSettled([
      upsertTaskInHubspot(record),
      searchInServiceM8UsingCustomField("job.json", "uuid", record?.job_uuid),
    ]);

    if (upsertTaskResult.status === "rejected") {
      logger.info(`Skipped: Could not upsert Task for ${record.uuid}`);
      return;
    }
    // Upsert task with idempotency
    const upsertTask = upsertTaskResult.value;
    // Fetch job from servicem8 using job_uuid and uosert deal in hubspot to ensure data integrity
    logger.info(`Upserted Task : ${JSON.stringify(upsertTask, null, 2)}`);

    const fetchJob =
      fetchJobResult.status === "fulfilled" ? fetchJobResult.value : [];

    if (fetchJob && fetchJob.length === 0) {
      logger.info(`Job not found for ${record?.job_uuid}`);
      return;
    }

    // Upsert job with idempotency
    const upsertDealInHubspot = await processSingleDealInHubspot(
      fetchJob[0],
      0,
      1
    );
    // logger.info(
    //   `Upserted Job: ${JSON.stringify(upsertDealInHubspot, null, 2)}`
    // );

    if (upsertDealInHubspot && upsertTask) {
      const associateTaskToJob = await client.associations.associate(
        "deals",
        upsertDealInHubspot?.id,
        "tasks",
        upsertTask?.id,
        215
      );

      logger.info(`Associate DealId : ${
        upsertDealInHubspot?.id
      } with TaskId : ${upsertTask?.id} 
       Result : ${JSON.stringify(associateTaskToJob, null, 2)}`);
    }
  } catch (error) {
    logger.error(
      `❌ Error processing search in Hubspot:processSingleTasksInHubspot`,
      {
        httpStatus: error?.status,
        response: error?.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error?.message,
        stack: error?.stack || error,
      }
    );
  }
}

async function upsertTaskInHubspot(record) {
  try {
    const task = taskClient();
    const payload = taskMappingSM8ToHS(record);
    logger.info(`payload: ${JSON.stringify(payload, null, 2)}`);

    // search task in hubspot using sourceid which is task uuid from serviceM8

    let properties = taskProperties();
    let existingTask = null;
    existingTask = await task.getCustomObjectByCustomField(
      "service_m8_uuid",
      record?.uuid,
      properties
    );
    logger.info(`Existing task: ${JSON.stringify(existingTask, null, 2)}`);
    // properties = properties.join(",");

    if (existingTask && existingTask?.id) {
      // update task
      return await task.update(existingTask?.id, payload, properties);
    }

    // const taskCreated = await task.create(payload);
    // logger.info(`Created Task: ${JSON.stringify(taskCreated, null, 2)}`);

    return await task.create(payload);
    // Upsert Task with idempotency
  } catch (error) {
    logger.error("❌ HubSpot Task failed to upsert (outer catch):", {
      httpStatus: error?.status,
      response: error?.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error?.message,
      stack: error?.stack || error,
    });
  }
}

async function HubspotToServiceM8Sync() {
  try {
    await syncHubspotDealToServiceM8Job();
    await syncHubspotContactToServiceM8Client();
    await syncHubspotCompanyToServiceM8Client();
  } catch (error) {
    logger.error(
      `❌ Error processing search in Hubspot:HubspotToServiceM8Sync`,
      {
        httpStatus: error?.status,
        response: error?.response?.data,
        method: error?.method,
        url: error?.config?.url,
        message: error?.message,
        stack: error?.stack || error,
      }
    );
  }
}
export {
  //  -----------------------[Hubspot Search & Fetch] ------------------------------------
  fetchHubSpotObject, // Fetch object from hubspot
  fetchHubSpotAssociationIds, // Fetch associated ids from hubspot
  searchInHubspot, // Search in hubspot
  findContactInHubspot,

  // --------------------------[Batch Process & Orchestration]    -----------------------------------
  processBatchContactInHubspot, // Bulk Process Contacts Sync
  processBatchDealInHubspot, // Bulk Process Deals Sync
  processBatchActivityInHubspot, // Bulk Process Activity(Note) Sync
  processBatchTasksInHubspot, // Bulk Process Tasks Sync
  processBatchCompanyInHubspot, // Bulk Process Company Sync

  // -----------------------[Single Process & Orchestration]    -----------------------------------
  processSingleDealInHubspot, // ProcessSingle Deal Sync

  // --------------------------[Hubspot -> ServiceM8]--------------------------
  //  Deal -> Job
  syncHubspotDealToServiceM8Job,
  // Contact -> Client
  syncHubspotContactToServiceM8Client,
  // Company -> Client
  syncHubspotCompanyToServiceM8Client,

  // -----------------------[Hubspot -> ServiceM8]    -----------------------------------
  HubspotToServiceM8Sync,
};
