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

function companyMappingSM8ToHS(record) {
  const payload = cleanProps({
    sourceid: record?.uuid,
    name: record?.name,
    domain: record?.website,
    address: record?.address_street,
    city: record?.address_city,
    state: record?.address_state,
    country: record?.address_country,
    zip: record?.address_postcode,
    // fax: record?.fax_number,
  });

  return payload;
  //   return { properties: payload };
}

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

export {
  contactMappingSM8ToHS,
  dealMappingSM8ToHS,
  activityMappingSM8ToHS,
  companyMappingSM8ToHS,
};
