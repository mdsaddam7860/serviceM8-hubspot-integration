import { logger, cleanProps, convertAustralianFormat } from "../index.js";

function extractName(fullName = "") {
  if (typeof fullName !== "string") {
    return { firstName: "", lastName: "" };
  }

  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");

  return { firstName, lastName };
}
/**
 * Maps a serviceM8 contact to a Hubspot contact.
 * It takes a serviceM8 contact record and contact info from serviceM8
 * and returns a Hubspot contact payload.
 * @param {Object} record - serviceM8 contact record
 * @param {Object} contactInfo - contact info from serviceM8
 * @return {Object} Hubspot contact payload
       
        
 */
function contactMappingSM8ToHS(record = {}, contactInfo = {}) {
  const { firstName, lastName } = extractName(record?.name);
  const payload = cleanProps({
    sourceid: record?.uuid || contactInfo.uuid,
    email: contactInfo?.email,
    phone: convertAustralianFormat(contactInfo.phone),
    mobilephone: convertAustralianFormat(contactInfo.mobile),
    firstname: contactInfo.first || firstName,
    lastname: contactInfo.last || lastName,
    website: record?.website,
    address: record?.address,
    city: record?.address_city,
    state: record?.address_state,
    zip: record?.address_postcode,
    fax: record?.fax_number,
    // parent_company_uuid
    // payment_terms
    // billing_attention
    // "tax_rate_uuid": "",
    // active: 1,
    // is_individual: 1,
    // badges: "",
    // billing_address
    // address_street
    // ----------------------
    // is_primary_contact
    // type: "Property Owner",
    // uuid: "4c70878c-5b67-47cd-af07-6c105844989b",
  });

  return payload;
  //   return { properties: payload };
}

/**
 * Maps a serviceM8 company to a Hubspot company.
 * It takes a serviceM8 company record and contact info from serviceM8
 * and returns a Hubspot company payload.
 * @param {Object} record - serviceM8 company record
 * @param {Object} contactInfo - contact info from serviceM8
 * @return {Object} Hubspot company payload
 */
function companyMappingSM8ToHS(record, contactInfo = {}) {
  const payload = cleanProps({
    sourceid: record?.uuid,
    name: record?.name,
    domain: record?.website,
    address: record?.address,
    address2: record?.address_street,
    city: record?.address_city,
    state: record?.address_state,
    country: record?.address_country,
    zip: record?.address_postcode,
    phone: contactInfo.mobile,
    // parent_company_uuid
    // payment_terms
    // billing_attention
    // tax_rate_uuid
    // fax_number
    // badges
    // is_individual
    // active
    // billing_address
  });

  return payload;
  //   return { properties: payload };
}

/**
 * Maps a ServiceM8 deal to a Hubspot deal.
 * It takes a ServiceM8 deal record and returns a Hubspot deal payload.
 * @param {Object} record - ServiceM8 deal record
 * @return {Object} Hubspot deal payload
    

*/
// function dealMappingSM8ToHS(record = {}) {
//   const payload = cleanProps({
//     job_uuid_service_m8: record?.uuid,
//     job_status_servicem8: record?.status,
//     job_address_service_m8: record?.job_address,
//     billing_address_service_m8: record?.billing_address,
//     job_description: record?.billing_address,
//     quote_sent_service_m8: record?.quote_sent,
//     quote_sent_timestamp_service_m8: record?.quote_sent_stamp,
//     invoice_sent_timestamp_service_m8: record?.invoice_sent_stamp,
//     purchase_order_number_service_m8: record?.purchase_order_number,
//     invoice_sent_service_m8: record?.invoice_sent,
//     payment_received_timestamp_service_m8: record?.payment_received_stamp,
//     payment_received_service_m8: record?.payment_received,
//     amount: record?.payment_amount,
//     job_unsuccessful_date_service_m8: record?.unsuccessful_date,
//     completion_date_service_m8: record?.completion_date,
//     generated_job_id_service_m8: record?.generated_job_id,
//     work_order_date_service_m8: record?.work_order_date,

//     sourceid: record?.uuid,
//     dealname: record?.billing_address,
//     pipeline: "1322868159",

//     // quote_date: "0000-00-00 00:00:00",
//     // work_done_description: "",
//     // lng: 152.6178099,
//     // lat: -26.2518484,
//     // active: 1,
//     // completion_actioned_by_uuid: "58998df3-ecc7-4760-a0e5-1fe9a07e40eb",
//     // payment_date: "2026-02-18 00:00:00",
//     // payment_method: "Xero",
//     // payment_actioned_by_uuid: "687d86c1-43c4-444e-9a6a-1cd3ccba40fb",
//     // geo_is_valid: 1,
//     // payment_note: "",
//     // ready_to_invoice: "1",
//     // ready_to_invoice_stamp: "2026-02-17 15:37:35",
//     // company_uuid: "13b11e39-d767-4efd-900c-21b096835cab",
//     // geo_country: "Australia",
//     // geo_postcode: "4570",
//     // geo_state: "QLD",
//     // geo_city: "Pie Creek",
//     // geo_street: "Meadow View Court",
//     // geo_number: "13",
//     // payment_processed: 1,
//     // payment_processed_stamp: "2026-02-17 15:39:40",
//     // total_invoice_amount: "205.0000",
//     // job_is_scheduled_until_stamp: "2026-02-17 07:00:00",
//     // category_uuid: "c1bbc747-7a31-4084-a9d5-20156545f7cb",
//     // queue_uuid: "",
//     // queue_expiry_date: "0000-00-00 00:00:00",
//     // badges: '["32c1bf36-c255-4d93-b7f7-22983fa496ab"]',
//     // queue_assigned_staff_uuid: "",
//     // created_by_staff_uuid
//     // related_knowledge_articles: false,
//     // customfield_application_number: "",
//     // customfield_lot: "0",
//     // customfield_plan: "",
//     // active_network_request_uuid: "",
//     // customfield_lead_source: "",
//     // customfield_xero_tracking_cat_1: "",
//     // customfield_xero_tracking_cat_2: "HSTP Service",
//   });

//   return payload;
//   //   return { properties: payload };
// }
function dealMappingSM8ToHS(record = {}) {
  // Helper to convert ServiceM8 dates (YYYY-MM-DD HH:MM:SS) to HubSpot Timestamps (Unix Milliseconds)
  const toHubSpotDate = (dateStr) => {
    if (!dateStr || dateStr.startsWith("0000") || dateStr === "") return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date.getTime();
  };

  // Helper to ensure Booleans are sent as strings "true"/"false"
  const toHSBool = (val) => {
    if (val === 1 || val === true || val === "1" || val === "true")
      return "true";
    return "false";
  };

  const payload = cleanProps({
    // --- Identifiers & Status ---
    job_uuid_service_m8: record?.uuid,
    job_status_servicem8: record?.status,
    generated_job_id_service_m8: record?.generated_job_id,
    sourceid: record?.uuid,
    dealname: record?.job_address?.split("\n")[0] || "New Job", // Using address as name, or a fallback
    pipeline: "default",
    dealstage: "2564260296",

    // --- Descriptions & Addresses ---
    job_address_service_m8: record?.job_address,
    billing_address_service_m8: record?.billing_address,
    // FIX: Changed mapping to record.job_description and ensured internal name matches HubSpot logic
    // (Ensure the internal name in HS is actually 'job_description_service_m8' or similar)
    job_description_service_m: record?.job_description,

    // --- Financials ---
    amount: record?.payment_amount,
    purchase_order_number_service_m8: record?.purchase_order_number,

    // --- Booleans (Converted to "true"/"false") ---
    quote_sent_service_m8: toHSBool(record?.quote_sent),
    invoice_sent_service_m8: toHSBool(record?.invoice_sent),
    payment_received_service_m8: toHSBool(record?.payment_received),

    // --- Timestamps (Converted to Milliseconds) ---
    quote_sent_timestamp_service_m8: toHubSpotDate(record?.quote_sent_stamp),
    invoice_sent_timestamp_service_m8: toHubSpotDate(
      record?.invoice_sent_stamp
    ),
    payment_received_timestamp_service_m8: toHubSpotDate(
      record?.payment_received_stamp
    ),
    job_unsuccessful_date_service_m8: toHubSpotDate(record?.unsuccessful_date),
    completion_date_service_m8: toHubSpotDate(record?.completion_date),
    work_order_date_service_m8: toHubSpotDate(record?.work_order_date),
  });

  return payload;
}

/**
 * 
 * uuid: "0049830c-60a4-426b-a91c-23b7001c8b0a",
      edit_by_staff_uuid: "4981eca6-f6d2-43aa-a1e6-20bb3dce008b",
      create_date: "2026-01-13 14:10:21",
      edit_date: "2026-01-13 14:10:21",
      active: 1,
      note: "System alarming on arrival, pump has failed. Replaced d25 with reefe 250.",
      action_required: "0",
      action_completed_by_staff_uuid: "",
      related_object: "job",
      related_object_uuid: "72030075-36bd-4d42-924c-23b6cc64b8ad",
 */
function activityMappingSM8ToHS(record = {}) {
  const formattedTimestamp = new Date(
    record.create_date.replace(" ", "T") + "Z"
  ).getTime();
  const payload = cleanProps({
    hs_note_body: record?.note,
    hs_timestamp: formattedTimestamp,
  });

  return payload;
  //   return { properties: payload };
}

export {
  contactMappingSM8ToHS,
  dealMappingSM8ToHS,
  activityMappingSM8ToHS,
  companyMappingSM8ToHS,
};
