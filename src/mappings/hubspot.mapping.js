import { logger, cleanProps } from "../index.js";

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
function contactMappingSM8ToHS(record) {
  const { firstName, lastName } = extractName(record?.name);
  const payload = cleanProps({
    sourceid: record?.uuid,
    email: record?.email,
    firstname: firstName,
    lastname: lastName,
    website: record?.website,
    address: record?.address_street,
    city: record?.address_city,
    state: record?.address_state,
    fax: record?.fax_number,
  });

  return payload;
  //   return { properties: payload };
}

/**
 * 
 * uuid: "16eea0d2-7076-41de-8b42-23c9929c04ab",
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
 *  */
function dealMappingSM8ToHS(record) {
  const payload = cleanProps({
    sourceid: record?.uuid,
    dealname: record?.billing_address,
    pipeline: "1322868159",
    amount: record?.total_invoice_amount,
    description: record?.job_description,
  });

  return payload;
  //   return { properties: payload };
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

export { contactMappingSM8ToHS, dealMappingSM8ToHS, activityMappingSM8ToHS };
