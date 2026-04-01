import { logger, cleanProps, convertAustralianFormat } from "../index.js";

/**
 * Maps a ServiceM8 record to a Hubspot record.
 * @param {Object} record - The ServiceM8 record to be mapped.
 * @returns {Object} - The mapped Hubspot record.
 * @example
 * const record = {
 *   properties: {
 *     amount: "35012.05",
 *     closedate: null,
 *     createdate: "2025-12-02T06:28:35.710Z",
 *     dealname: "Flourish Homes",
 *     dealstage: "2114542054",
 *     hs_lastmodifieddate: "2026-02-10T05:04:30.527Z"
 *   }
 * };
 * const mappedRecord = jobMappingHSTOSM8(record);
 * console.log(mappedRecord);
 * // Output: { uuid: "58998df3-ecc7-4760-a0e5-1fe9a07e40eb", active: 1, ... }
 */
function jobMappingHSTOSM8(deal = {}, job_uuid) {
  const record = deal.properties || {};

  const reversedPayload = cleanProps({
    // --- Identifiers & Status ---
    uuid: record.job_uuid_service_m8 || job_uuid,
    // status: record.job_status_servicem8,
    // Fix 2: Only sync status if it exists in HS to avoid nulling it out
    ...(record.job_status_servicem8 && {
      status: parseInt(record.job_status_servicem8),
    }),
    active: 1,
    generated_job_id: record.generated_job_id_service_m8,

    // --- Addresses & Description ---
    job_address: record.job_address_service_m8,
    billing_address: record.billing_address_service_m8,
    job_description: record.job_description_service_m,

    // --- Financials ---
    // payment_amount: record.amount,
    purchase_order_number: record.purchase_order_number_service_m8,

    // --- Booleans ---
    quote_sent: record.quote_sent_service_m8,
    invoice_sent: record.invoice_sent_service_m8,
    payment_received: record.payment_received_service_m8,

    // --- Timestamps ---
    // quote_sent_stamp: record.quote_sent_timestamp_service_m8,
    // invoice_sent_stamp: record.invoice_sent_timestamp_service_m8,
    // payment_received_stamp: record.payment_received_timestamp_service_m8,
    unsuccessful_date: record.job_unsuccessful_date_service_m8,
    completion_date: record.completion_date_service_m8,
    work_order_date: record.work_order_date_service_m8,
  });

  return reversedPayload;
}

// function jobMappingHSTOSM8(deal = {}, job_uuid) {
//   const record = deal.properties || {};

//   // Construct a proper address string from HS properties
//   const fullAddress = [record.address, record.city, record.state, record.zip]
//     .filter(Boolean)
//     .join(", ");

//   const payload = {
//     uuid: record.job_uuid_service_m8 || job_uuid,
//     active: 1,

//     // Fix 1: Use actual address fields, not Deal Name
//     job_address: record.job_address_service_m8,
//     billing_address: record.billing_address_service_m8,
//     job_description: record.job_description_service_m,

//     // Fix 2: Only sync status if it exists in HS to avoid nulling it out
//     ...(record.job_status_servicem8 && {
//       status: parseInt(record.job_status_servicem8),
//     }),

//     // Fix 3: REMOVED payment_amount to prevent phantom payments
//     purchase_order_number: record.purchase_order_number_service_m8,

//     // Booleans
//     quote_sent: record.quote_sent_service_m8,
//     invoice_sent: record.invoice_sent_service_m8,
//     payment_received: record.payment_received_service_m8,

//     // Timestamps
//     unsuccessful_date: record.job_unsuccessful_date_service_m8,
//     completion_date: record.completion_date_service_m8,
//     work_order_date: record.work_order_date_service_m8,
//   };

//   return cleanProps(payload);
// }

/**
 * Maps a Hubspot record to a ServiceM8 record.
 * @param {Object} record - The Hubspot record to be mapped.
 * @returns {Object} - The mapped ServiceM8 record.
 * @example
 * const record = {
 *   properties: {
 *     sourceid: "58998df3-ecc7-4760-a0e5-1fe9a07e40eb",
 *     firstname: "John",
 *     lastname: "Doe",
 *     website: "",
 *     address: "17 Tarrawarrah Avenue\nTallai, Queensland",
 *     city: "Tallai",
 *     state: "Queensland",
 *     zip: "",
 *     country: "Australia"
 *   }
 * };
 * const mappedRecord = clientMappingHSTOSM8(record);
 * console.log(mappedRecord);
 * // Output: { uuid: "58998df3-ecc7-4760-a0e5-1fe9a07e40eb", name: "John Doe", website: "", address: "17 Tarrawarrah Avenue\nTallai, Queensland", address_street: "17 Tarrawarrah Avenue", address_city: "Tallai", address_state: "Queensland", address_postcode: "", address_country: "Australia" }
 */
function clientMappingHSTOSM8(record = {}) {
  const contact = record.properties || {};
  const payload = cleanProps({
    uuid: contact?.sourceid,
    name: contact?.firstname + " " + contact?.lastname,
    website: contact?.website,
    address: contact?.address,
    address_street: contact?.address,
    address_city: contact?.city,
    address_state: contact?.state,
    address_postcode: contact?.zip,
    address_country: contact?.country,
    // abn_number: "",
    // billing_address: "17 Tarrawarrah Avenue\nTallai, Queensland",
    // active: 1,
  });

  return payload;
}
function contactMappingHSTOSM8(record = {}, existingContact = []) {
  const contact = record.properties || {};
  const props2 = existingContact[0] || {};
  const payload = cleanProps({
    uuid: props2?.uuid || contact?.sourceid,
    name: `${contact?.firstname} ${contact?.lastname}`,
    website: contact?.website,
    address: contact?.address,
    address_street: contact?.address,
    address_city: contact?.city,
    address_state: contact?.state,
    address_postcode: contact?.zip,
    address_country: contact?.country,
    is_individual: 1,
    active: 1,
    // abn_number: "",
    // billing_address: "17 Tarrawarrah Avenue\nTallai, Queensland",

    // badges: "",
    // fax_number: "",
    // tax_rate_uuid: "",
    // billing_attention: "0",
    // payment_terms: "COD",
    // parent_company_uuid: "",
  });

  return payload;
}
function companyContactMappingHSTOSM8(
  record = {},
  company_uuid,
  existingContact = []
) {
  if (!record || !company_uuid) {
    logger.warn(`Missing record or company_uuid`);
    return null;
  }
  const contact = record.properties || {};
  const existingContactInSM8 = existingContact ? existingContact[0] : {};
  const payload = cleanProps({
    uuid: existingContactInSM8?.uuid || contact?.sourceid,
    first: contact?.firstname,
    last: contact?.lastname,
    phone: contact?.phone,
    mobile: contact?.mobilephone,
    email: contact?.email,
    company_uuid,
    // type: "string",
    // is_primary_contact: "string",
  });

  return payload;
}
function jobContactMappingHSTOSM8(record = {}, job_uuid, existingContact = []) {
  if (!record || !job_uuid) {
    logger.warn(`Missing record or company_uuid`);
    return null;
  }
  const contact = record.properties || {};
  const existingContactInSM8 = existingContact ? existingContact[0] : {};
  const payload = cleanProps({
    uuid: existingContactInSM8?.uuid || contact?.sourceid,
    first: contact?.firstname,
    last: contact?.lastname,
    phone: contact?.phone,
    mobile: contact?.mobilephone,
    email: contact?.email,
    job_uuid,
    type: "Billing Contact",
    // is_primary_contact: "string",
  });

  return payload;
}
function companyMappingHSTOSM8(record = {}, existingCompany = []) {
  const props = record.properties || {};
  const props2 = existingCompany[0] || {};
  const payload = cleanProps({
    uuid: props2.uuid || props.sourceid,
    // edit_date: "2021-03-22 14:36:20",
    name: props.name,
    website: props.domain,
    address: props.address,
    address_street: props.address2,
    address_city: props.city,
    address_state: props.state,
    address_postcode: props.zip,
    address_country: props.country,
    active: 1,
    is_individual: 0,
    // badges: "",
    // fax_number: "",
    // tax_rate_uuid: "",
    // billing_attention: "0",
    // payment_terms: "COD",
    // parent_company_uuid: "",
    // billing_address: props.abc,
    // abn_number:props.abs,
  });

  return payload;
}
export {
  jobContactMappingHSTOSM8,
  companyContactMappingHSTOSM8,
  jobMappingHSTOSM8,
  clientMappingHSTOSM8,
  contactMappingHSTOSM8,
  companyMappingHSTOSM8,
};
