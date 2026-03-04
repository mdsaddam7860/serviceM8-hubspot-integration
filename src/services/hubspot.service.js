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
async function findContactInHubspot(contactInfo = {}) {
  try {
    const hs_client = getHubspotClient();

    const rawPhone = contactInfo?.mobile ? contactInfo?.mobile : null;

    // 1. Remove all spaces and non-digit characters
    // let cleaned = rawPhone;
    let cleaned = rawPhone.replace(/\D/g, "");

    // 2. Replace leading '0' with '+61'
    if (cleaned.startsWith("0")) {
      cleaned = "+61" + cleaned.substring(1);
    } else if (cleaned && !cleaned.startsWith("61")) {
      // Optional: Add +61 if it's missing entirely
      cleaned = "+61" + cleaned;
    }

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
      // {
      //   filters: [
      //     {
      //       propertyName: "phone",
      //       operator: "EQ",
      //       value: cleaned,
      //     },
      //   ],
      // },
    ];

    let existingContact = null;

    // Search Contact by phone number
    existingContact = await hs_client.contacts.searchContacts(filterGroups);

    // Return the contact if its length is 1
    if (existingContact?.results?.length >= 1) {
      logger.info(
        `existingContact found by mobilephone : ${JSON.stringify(
          existingContact
        )}`
      );
      return existingContact.results[0];
    }

    // Search by phone and email if it has more than 1 result
    if (existingContact.results.length > 1) {
      logger.info(
        `exisingContact found by phone is more than one switching to search by phone and email: ${existingContact?.results?.length}`
      );
      // search based on email and phone
      const filterGroups = [
        {
          // Search Email and phone
          filters: [
            { propertyName: "email", operator: "EQ", value: contactInfo.email },
            {
              propertyName: "phone",
              operator: "EQ",
              value: cleaned,
            },
          ],
        },
      ];
      existingContact = await hs_client.contacts.searchContacts(filterGroups);

      if (existingContact?.results?.length >= 1) {
        return existingContact.results[0];
      }
    }

    // logger.info(`existingContact length: ${existingContact?.results?.length}`);
    // return;

    // Search by email if it has 0 result
    if (existingContact?.results?.length === 0) {
      logger.info(
        `exisingContact found by phone is Zero switching to search by email`
      );
      return await hs_client.contacts.getContactByCustomField(
        "email",
        contactInfo.email
      );
      // logger.info(
      //   `existingContact found by email: ${JSON.stringify(
      //     existingContact,
      //     null,
      //     2
      //   )}`
      // );
    }
  } catch (error) {
    logger.error("❌ Error finding  existing Contact in Hubspot", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      stack: error,
    });

    throw error;
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

async function upsertContactInHubspot(record = {}, contactInfo = {}) {
  try {
    const hs_client = getHubspotClient();
    const payload = contactMappingSM8ToHS(record, contactInfo);

    let existingContact = await findContactInHubspot(contactInfo);

    const isEmailConflict = (error) => {
      const message = error?.response?.data?.message || "";
      return (
        error?.response?.data?.category === "VALIDATION_ERROR" &&
        message.includes("propertyName=email")
      );
    };

    const removeEmailFromPayload = (originalPayload) => {
      const cloned = {
        ...originalPayload,
        // properties: { ...originalPayload.properties },
      };
      delete cloned.email;
      return cloned;
    };

    if (existingContact) {
      try {
        return await hs_client.contacts.updateContact(
          existingContact.id,
          payload
        );
      } catch (error) {
        logger.error("❌ HubSpot Contact update failed:", {
          status: error?.response?.status,
          message: error?.response?.data?.message,
          category: error?.response?.data?.category,
        });

        // 🔁 Retry without email if duplicate email conflict
        if (isEmailConflict(error)) {
          logger.warn(
            "⚠️ Email conflict detected. Retrying update without email..."
          );

          const retryPayload = removeEmailFromPayload(payload);

          return await hs_client.contacts.updateContact(
            existingContact.id,
            retryPayload
          );
        }

        throw error; // don't swallow unknown errors
      }
    } else {
      try {
        return await hs_client.contacts.createContact(payload);
      } catch (error) {
        logger.error("❌ HubSpot Contact create failed:", {
          status: error?.response?.status,
          message: error?.response?.data?.message,
          category: error?.response?.data?.category,
        });

        if (isEmailConflict(error)) {
          logger.warn(
            "⚠️ Email conflict detected. Retrying create without email..."
          );

          const retryPayload = removeEmailFromPayload(payload);

          return await hs_client.contacts.createContact(retryPayload);
        }

        throw error;
      }
    }
  } catch (error) {
    logger.error("❌ HubSpot Contact failed to upsert (outer catch):", {
      status: error?.response?.status,
      message: error?.response?.data?.message,
    });

    throw error;
  }
}
async function upsertCompanyInHubspot(
  record = {
    uuid: "0582f095-132d-4086-9aec-2364ff30690b",
    edit_date: "2025-12-08 13:55:31",
    name: "Josh Olsen Carpentry",
    website: "",
    abn_number: "",
    address: "60 Woodside Street\nThe Gap QLD 4061 ",
    address_street: "60 Woodside Street\nThe Gap QLD 4061",
    address_city: "",
    address_state: "",
    address_postcode: "",
    address_country: "",
    billing_address: "60 Woodside Street\nThe Gap QLD 4061",
    active: 1,
    is_individual: 0,
    badges: "[]",
    fax_number: "",
    tax_rate_uuid: "",
    billing_attention: "0",
    payment_terms: "",
    parent_company_uuid: "",
  },
  contactInfo = {}
) {
  try {
    // Find company if exist update else create company
    const hs_client = getHubspotClient();

    // Find contact info from serviceM8
    // const query = "companycontact.json";
    // const contactInfo = await searchInServiceM8UsingCustomField(
    //   query,
    //   "company_uuid",
    //   record?.uuid
    // );

    // logger.info(`Fetched ${query} : ${JSON.stringify(contactInfo, null, 2)}`);

    // if (!contactInfo) {
    //   logger.warn(`Contact info not found for ${record?.uuid}`);
    //   return;
    // }

    const sourceid = record?.uuid;
    const payload = companyMappingSM8ToHS(record, contactInfo); // Change to company
    // const payload = {
    //   firstname: record?.name,
    //   sourceid: sourceid,
    // };

    // search company based on sourceid

    const existingContact = await hs_client.companies.getCompanyByCustomField(
      "sourceid",
      sourceid
    );

    if (existingContact) {
      return await hs_client.companies.updateCompany(
        existingContact?.id,
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
    {
      uuid: "9a4b098b-dc6b-4ab9-a452-1cd3ce1d04eb",
      edit_date: "2021-08-17 13:02:29",
      name: "Teresa Stanton",
      website: "",
      abn_number: "",
      address: "1 Tudor Court\nDelaneys Creek QLD 4514",
      address_street: "1 Tudor Court\nDelaneys Creek QLD 4514",
      address_city: "",
      address_state: "",
      address_postcode: "",
      address_country: "",
      billing_address: "1 Tudor Court\nDelaneys Creek QLD 4514",
      active: 1,
      is_individual: 1,
      badges: "",
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
      logger.info(`✅ Processing record  ${JSON.stringify(record, null, 2)}`);

      // Find contact if exist update else create contact, first search based on phone number then email
      const hs_client = getHubspotClient();

      // Find contact info from serviceM8
      const query = "companycontact.json";
      const contacts = await searchInServiceM8UsingCustomField(
        query,
        "company_uuid",
        record?.uuid
      );

      if (!contacts) {
        logger.warn(`Contact info not found for ${record?.uuid}`);
        return;
      }

      for (const [inner_index, contact] of contacts.entries()) {
        try {
          logger.info(
            `Processing  ${inner_index} : ${JSON.stringify(contact)}`
          );
          // Upsert Contact in hubspot
          const upsertContact = await upsertContactInHubspot(record, contact);
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
            stack: error,
          });
        }
      }
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
async function processBatchCompanyInHubspot(
  records = [
    {
      uuid: "2ef996a9-018f-405e-85f8-1fb1c3bb77fb",
      edit_date: "2026-01-05 10:13:59",
      name: "Jon and Naomi West",
      website: "",
      abn_number: "",
      address: "54-64 Cathy Ct,\nCaboolture QLD 4510",
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
      logger.info(`✅ Processing Company  ${JSON.stringify(record, null, 2)}`);

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
      logger.info(
        `✅ Upserted Company  ${JSON.stringify(upsertCompany, null, 2)}`
      );

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

      // const hs_client = getHubspotClient();

      // Associate with contact
      // for (const [inner_index, contactInfo] of contacts.entries()) {
      //   try {
      //     // Find contact asociate with company
      //     if (!contactInfo.phone && !contactInfo.email) {
      //       logger.warn(
      //         `Phone and email is empty for ${
      //           contactInfo.uuid
      //         } : ${JSON.stringify(contactInfo)}`
      //       );
      //       continue;
      //     }
      //     logger.info(
      //       `✅ Processing contact at index:${inner_index + 1} ${JSON.stringify(
      //         contactInfo
      //       )}`
      //     );

      //     let existingContact = null;

      //     // if (contactInfo.phone) {
      //     //   existingContact = await hs_client.contacts.getContactByCustomField(
      //     //     "phone",
      //     //     contactInfo.phone
      //     //   );
      //     //   logger.info(
      //     //     `existingContact found by phone: ${JSON.stringify(
      //     //       existingContact,
      //     //       null,
      //     //       2
      //     //     )}`
      //     //   );
      //     // }

      //     // // if found assocaite with hubspot deal

      //     // if (!existingContact && contactInfo.email) {
      //     //   existingContact = await hs_client.contacts.getContactByCustomField(
      //     //     "email",
      //     //     contactInfo.email
      //     //   );
      //     //   logger.info(
      //     //     `existingContact found by email: ${JSON.stringify(
      //     //       existingContact,
      //     //       null,
      //     //       2
      //     //     )}`
      //     //   );
      //     // }

      //     existingContact = await upsertContactInHubspot({}, contactInfo);

      //     logger.info(
      //       `✅ Upserted contact  ${JSON.stringify(existingContact, null, 2)}`
      //     );
      //     if (existingContact?.id && upsertCompany?.id) {
      //       const associate = await hs_client.associations.associate(
      //         "contact",
      //         existingContact?.id,
      //         "company",
      //         upsertCompany?.id,
      //         "279",
      //         "HUBSPOT_DEFINED"
      //       );

      //       logger.info(
      //         `✅ Associate contact Id : ${
      //           existingContact?.id
      //         } with Company Id ${upsertCompany?.id}: ${JSON.stringify(
      //           associate,
      //           null,
      //           2
      //         )}`
      //       );
      //     }
      //     // return; // TODO Remove after testing
      //   } catch (error) {
      //     logger.error("❌ Error processing contact:", {
      //       status: error?.status,
      //       response: error.response?.data,
      //       method: error?.method,
      //       url: error?.config?.url,
      //       headers: error?.config?.headers,
      //       stack: error,
      //     });
      //   }
      // }
    } catch (error) {
      logger.error("❌ Error processing Company:", {
        status: error?.status,
        response: error.response?.data,
        method: error?.method,
        url: error?.config?.url,
        headers: error?.config?.headers,
        stack: error.stack,
      });
      // console.error(error);
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

        let existingContact = null;

        // if (contactInfo.phone) {
        //   existingContact = await hs_client.contacts.getContactByCustomField(
        //     "phone",

        existingContact = await upsertContactInHubspot({}, contactInfo);

        logger.info(
          `✅ Upserted contact  ${JSON.stringify(existingContact, null, 2)}`
        );
        if (existingContact?.id && companyId) {
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
    {
      uuid: "05a10154-0123-45bc-804a-2396df4e950d",
      active: 1,
      date: "2025-12-11 00:00:00",
      job_address: "412 Hemmant Tingalpa Rd\nHemmant QLD 4174",
      billing_address: "412 Hemmant Tingalpa Rd\nHemmant QLD 4174",
      status: "Completed",
      quote_date: "0000-00-00 00:00:00",
      work_order_date: "2025-12-11 15:37:49",
      work_done_description: "",
      lng: 153.1337208,
      lat: -27.461306,
      generated_job_id: "39399",
      completion_date: "2025-12-17 12:34:29",
      completion_actioned_by_uuid: "f48ba2fb-d1ac-4555-b0d9-2009faba39bb",
      unsuccessful_date: "0000-00-00 00:00:00",
      payment_date: "2025-12-18 00:00:00",
      payment_method: "Xero",
      payment_amount: 570,
      payment_actioned_by_uuid: "687d86c1-43c4-444e-9a6a-1cd3ccba40fb",
      edit_date: "2025-12-19 05:45:46",
      geo_is_valid: 1,
      payment_note: "",
      ready_to_invoice: "1",
      ready_to_invoice_stamp: "2025-12-18 05:57:35",
      company_uuid: "6a0dadab-f917-4a91-8038-2396dee63ebb",
      geo_country: "Australia",
      geo_postcode: "4174",
      geo_state: "QLD",
      geo_city: "Hemmant",
      geo_street: "Hemmant Tingalpa Road",
      geo_number: "412",
      payment_processed: 1,
      payment_processed_stamp: "2025-12-18 05:59:03",
      payment_received: 1,
      payment_received_stamp: "2025-12-18 00:00:00",
      total_invoice_amount: "570.0000",
      job_is_scheduled_until_stamp: "2025-12-17 08:00:00",
      category_uuid: "f4460be7-395d-42ca-a465-22f384e3a8fb",
      queue_uuid: "",
      queue_expiry_date: "0000-00-00 00:00:00",
      badges: "",
      invoice_sent: true,
      purchase_order_number: "",
      invoice_sent_stamp: "2025-12-17 12:33:30",
      queue_assigned_staff_uuid: "",
      quote_sent_stamp: "0000-00-00 00:00:00",
      quote_sent: false,
      customfield_application_number: "",
      customfield_lot: "0",
      customfield_plan: "",
      active_network_request_uuid: "",
      customfield_lead_source: "",
      customfield_xero_tracking_cat_1: "",
      customfield_xero_tracking_cat_2: "",
      related_knowledge_articles: false,
      job_description: "17 DEC - HARMOR TO PUMP OUT SEPTIC AND GREASE TRAP",
      created_by_staff_uuid: "f48ba2fb-d1ac-4555-b0d9-2009faba39bb",
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

      // 1. Fetch Deal and Contacts in Parallel
      const [upsertResult, contactsResult] = await Promise.allSettled([
        upsertDealInHubspot(record),
        searchInServiceM8UsingCustomField(
          "jobcontact.json",
          "job_uuid",
          record?.uuid
        ),
      ]);

      const upsertDeal =
        upsertResult.status === "fulfilled" ? upsertResult.value : null;
      const contacts =
        contactsResult.status === "fulfilled" ? contactsResult.value : null;

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
      return; // TODO Remove after testing
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
      uuid: "0049830c-60a4-426b-a91c-23b7001c8b0a",
      edit_by_staff_uuid: "4981eca6-f6d2-43aa-a1e6-20bb3dce008b",
      create_date: "2026-01-13 14:10:21",
      edit_date: "2026-01-13 14:10:21",
      active: 1,
      note: "System alarming on arrival, pump has failed. Replaced d25 with reefe 250.",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "company",
      related_object_uuid: "72030075-36bd-4d42-924c-23b6cc64b8ad",
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
        const existingContact = await searchInHubspot(
          "contacts",
          "sourceid",
          record.related_object_uuid
        );
        contactId = existingContact[0]?.id;

        // logger.info(
        //   `✅ Existing Contact  ${JSON.stringify(existingContact, null, 2)}`
        // );

        if (!existingContact || !existingContact?.length > 0) {
          // fetch client
          const company = await searchInServiceM8(
            "company.json",
            record.related_object_uuid
          );
          // upsert contact
          const upsert = await upsertContactInHubspot(company);
          logger.info(
            `✅ Upserted Contact  ${JSON.stringify(upsert, null, 2)}`
          );
          contactId = upsert?.id;
        }

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
            } with Contact ${contactId}  ${JSON.stringify(associate, null, 2)}`
          );
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
async function syncContact({ log = logger } = {}) {
  try {
    const contactStream = hubspotGenerator("/crm/v3/objects/contacts");

    for await (const { records, stats } of contactStream) {
      log.info(`Processing a batch of ${records.length} Contacts...`);
      log.info(`Stats: ${JSON.stringify(stats, null, 2)}`);
    }
  } catch (error) {
    log.error("❌ Error processing Contact in Batch", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error.message,
    });
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
    const records = response.data?.results || [];
    // logger.info(`Search Result: ${JSON.stringify(records, null, 2)}`);
    return records;
  } catch (error) {
    logger.error("❌ Error processing Search in Hubspot", error);
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
            propertyName: "lastmodifieddate",
            operator: "GT",
            value: lastSyncMillis,
          },
        ],
      },
    ];
    // const properties = dealProperties();
    const dealStream = hubspotGenerator(endpoint, {
      properties: dealProperties(),
      filterGroups,
    });

    for await (const { records, stats } of dealStream) {
      // logger.info(`Processing a batch of ${records.length} Deals...`);
      // logger.info(`Stats: ${JSON.stringify(stats, null, 2)}`);
      logger.info(
        `Processing a batch of ${JSON.stringify(records[0], null, 2)} Deals...`
      );

      await processBatchDealInServiceM8(records);
      logger.info(`[ServiceM8 Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
      return;
    }
  } catch (error) {
    logger.error("❌ Error processing Deal in Batch", error);
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

    const contactStream = hubspotGenerator(endpoint, {
      properties: companyProperties(),
      filterGroups,
    });

    // const contactStream = hubspotGenerator(endpoint, properties, filterGroups);

    for await (const { records, stats } of contactStream) {
      await processBatchCompanyInServiceM8(records);
      logger.info(`[ServiceM8 Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
    }
  } catch (error) {
    logger.error("❌ Error processing Companies in Batch", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error.message,
    });
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
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error.message,
    });
  }
}
export {
  fetchHubSpotObject,
  fetchHubSpotAssociationIds,
  processBatchContactInHubspot,
  processBatchDealInHubspot,
  processBatchActivityInHubspot,
  syncContact,
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
