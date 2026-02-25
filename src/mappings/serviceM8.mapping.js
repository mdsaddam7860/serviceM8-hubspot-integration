import { logger, cleanProps, convertAustralianFormat } from "../index.js";
import { serviceM8Client } from "../configs/serviceM8.config.js";

/*!SECTION
"amount": "35012.05",
    "closedate": null,
    "createdate": "2025-12-02T06:28:35.710Z",
    "dealname": "Flourish Homes",
    "dealstage": "2114542054",
    "hs_lastmodifieddate": "2026-02-10T05:04:30.527Z"
*/

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
function jobMappingHSTOSM8(record = {}) {
  const deal = record.properties || {};
  const payload = cleanProps({
    uuid: deal?.sourceid,
    active: 1,
    // date: "2026-02-16 00:00:00",
    // job_address: "13 Meadow View Court\nPie Creek QLD 4570",
    // billing_address: "13 Meadow View Court\nPie Creek QLD 4570",
    status: "Completed",
    // quote_date: "0000-00-00 00:00:00",
    // work_order_date: "2026-02-16 12:59:59",
    // work_done_description: "",
    // lng: 152.6178099,
    // lat: -26.2518484,
    // generated_job_id: "41966",
    // completion_date: "2026-02-17 06:45:40",
    // completion_actioned_by_uuid: "58998df3-ecc7-4760-a0e5-1fe9a07e40eb",
    // unsuccessful_date: "0000-00-00 00:00:00",
    // payment_date: "0000-00-00 00:00:00",
    // payment_method: "",
    // payment_amount: 0,
    // payment_actioned_by_uuid: "",
    // edit_date: "2026-02-17 15:39:40",
    // geo_is_valid: 1,
    // payment_note: "",
    // ready_to_invoice: "1",
    // ready_to_invoice_stamp: "2026-02-17 15:37:35",
    // company_uuid: "13b11e39-d767-4efd-900c-21b096835cab",
    // geo_country: "Australia",
    // geo_postcode: "4570",
    // geo_state: "QLD",
    // geo_city: "Pie Creek",
    // geo_street: "Meadow View Court",
    // geo_number: "13",
    // payment_processed: 1,
    // payment_processed_stamp: "2026-02-17 15:39:40",
    // payment_received: 0,
    // payment_received_stamp: "0000-00-00 00:00:00",
    // total_invoice_amount: "205.0000",
    // job_is_scheduled_until_stamp: "2026-02-17 07:00:00",
    // category_uuid: "c1bbc747-7a31-4084-a9d5-20156545f7cb",
    // queue_uuid: "",
    // queue_expiry_date: "0000-00-00 00:00:00",
    // badges: '["32c1bf36-c255-4d93-b7f7-22983fa496ab"]',
    // invoice_sent: true,
    // purchase_order_number: "",
    // invoice_sent_stamp: "2026-02-17 06:45:56",
    // queue_assigned_staff_uuid: "",
    // quote_sent_stamp: "0000-00-00 00:00:00",
    // quote_sent: false,
    // customfield_application_number: "",
    // customfield_lot: "0",
    // customfield_plan: "",
    // active_network_request_uuid: "",
    // customfield_lead_source: "",
    // customfield_xero_tracking_cat_1: "",
    // customfield_xero_tracking_cat_2: "HSTP Service",
    // related_knowledge_articles: false,
    // job_description:
    //   "Please attend to HSTP that is alarming, must be \n\nBILLING INFO\nCall out fee - $160.00\nExtra hours - $90.00\nPlus materials",
    // created_by_staff_uuid: "f48ba2fb-d1ac-4555-b0d9-2009faba39bb",
  });

  return payload;
  //   return { properties: payload };
}

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
export { jobMappingHSTOSM8, clientMappingHSTOSM8 };
