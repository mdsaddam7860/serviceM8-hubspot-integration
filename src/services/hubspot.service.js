import { logger } from "../index.js";
import { getHubspotClient } from "../configs/hubspot.config.js";
import { hubspotExecutor, serviceM8Executor } from "../utils/executors.js";

async function upsertContactInHubspot(record) {
  try {
    // Find contact if exist update else create deal
    const hs_client = getHubspotClient();

    const sourceid = record?.uuid;
    const filterGroups = [
      {
        filters: [
          {
            propertyName: "sourceid",
            operator: "EQ",
            value: sourceid,
          },
        ],
      },
    ];
    // search contact based on sourceid
    const existingContact = await hs_client.contacts.searchContacts(
      filterGroups,
      (properties = []),
      (limit = 50),
      (after = null)
    );
  } catch (error) {
    logger.error("❌ HubSpot Contact failed to upsert:", {
      status: error.response?.status,
      response: error.response?.data,
      method: error.config?.method,
      url: error.config?.url,
      headers: error.config?.headers,
    });
  }
}
async function upsertDealInHubspot() {
  try {
    // Find deal if exist update else create deal
    const hs_client = getHubspotClient();
  } catch (error) {
    logger.error("❌ HubSpot Dea failed to upsert:", {
      status: error.response?.status,
      response: error.response?.data,
      method: error.config?.method,
      url: error.config?.url,
      headers: error.config?.headers,
    });
  }
}
async function upsertNoteInHubspot() {
  try {
    // Find Notes if exist update else create deal
    const hs_client = getHubspotClient();
  } catch (error) {
    logger.error("❌ HubSpot Note failed to upsert", {
      status: error.response?.status,
      response: error.response?.data,
      method: error.config?.method,
      url: error.config?.url,
      headers: error.config?.headers,
    });
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
      const hs_client = getHubspotClient();
      logger.info(`✅ Processing contact  ${JSON.stringify(contact, null, 2)}`);

      // Upsert Contact in hubspot
      const upsertContact = await upsertContactInHubspot(contact);
      logger.info(
        `✅ Upserted contact  ${JSON.stringify(upsertContact, null, 2)}`
      );
    } catch (error) {
      logger.error("❌ Error processing contact:", {
        status: error.response?.status,
        response: error.response?.data,
        method: error.config?.method,
        url: error.config?.url,
        headers: error.config?.headers,
      });
    }
  }
}
async function processBatchDealInHubspot(
  records = [
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
  for (const record of records) {
    try {
      const hs_client = getHubspotClient();
      logger.info(`✅ Processing record  ${JSON.stringify(record, null, 2)}`);

      // Upsert deal in hubspot
      //   const upsertContact = await hs_client.contacts.upsertContactByEmail(
      //     "test@example1.com"
      //   );
      //   logger.info(
      //     `✅ Upserted contact  ${JSON.stringify(upsertContact, null, 2)}`
      //   );
    } catch (error) {
      logger.error("❌ Error processing deal:", {
        status: error.response?.status,
        response: error.response?.data,
        method: error.config?.method,
        url: error.config?.url,
        headers: error.config?.headers,
      });
      //   logger.error("❌ Error processing contact:", error);
    }
  }
}

export { processBatchContactInHubspot, processBatchDealInHubspot };
