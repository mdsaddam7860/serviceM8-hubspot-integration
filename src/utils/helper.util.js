import fs from "fs";
import path from "path";
import { getHubspotClient } from "../configs/hubspot.config.js";
function delta() {
  const date = new Date();
  // date.setDate(date.getDate() - 2);
  date.setDate(date.getDate() - 1);

  const previousDate = date.toISOString().split("T")[0];
  return previousDate;
}
function currentDate() {
  const date = new Date();

  return date.toISOString().split("T")[0];
}

function contactProperties() {
  return [
    "email",
    "firstname",
    "lastname",
    "sourceid",
    "city",
    "state",
    "zip",
    "country",
    "website",
    "phone",
    "mobilephone",
    "address",
  ];
}
function dealProperties() {
  return [
    "sourceid",
    "dealname",
    "dealstage",
    "amount",
    "hs_lastmodifieddate",
    "job_status_servicem8",
    "job_uuid_service_m8",
    "generated_job_id_service_m8",
    "dealstage",
    "pipeline",
    "job_address_service_m8",
    "billing_address_service_m8",
    "job_description_service_m",
    "amount",
    "purchase_order_number_service_m8",
    "quote_sent_service_m8",
    "invoice_sent_service_m8",
    "payment_received_service_m8",
    "quote_sent_timestamp_service_m8",
    "invoice_sent_timestamp_service_m8",
    "payment_received_timestamp_service_m8",
    "job_unsuccessful_date_service_m8",
    "completion_date_service_m8",
    "work_order_date_service_m8",
  ];
}
function companyProperties() {
  return [
    "sourceid",
    "about_us",
    "city",
    "domain",
    "name",
    "country",
    "city",
    "street",
    "state",
    "zip",
    "address",
    "hs_country_code",
    "description",
    "address",
    "zip",
    "address2",
  ];
}

function cleanProps(obj) {
  if (!obj || typeof obj !== "object") return obj;

  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => {
      // Remove null or undefined
      if (value === null || value === undefined) return false;

      // Remove empty string
      if (typeof value === "string" && value.trim() === "") return false;

      // Remove empty array
      if (Array.isArray(value) && value.length === 0) return false;

      // Remove empty object
      if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
      )
        return false;

      return true;
    })
  );
}

// Use path.join to ensure cross-platform compatibility (Windows vs Mac/Linux)
const filePath = path.join(process.cwd(), "lastSyncTime.json");

/**
 * Reads the last sync time from the file.
 * If the file doesn't exist, it defaults to 1 hour ago.
 */
function getLastSyncTime() {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data).lastSync;
    }
  } catch (error) {
    console.error("Error reading sync file, falling back to default.", error);
  }

  // Fallback: If no file exists, return the timestamp from 1 hour ago
  // const oneHourAgo = new Date();
  // oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  // return oneHourAgo.toISOString();

  // TODO : Change delta to 1 Hour
  const fifteenMinsAgo = new Date();
  fifteenMinsAgo.setMinutes(fifteenMinsAgo.getMinutes() - 1);
  return fifteenMinsAgo.toISOString();
}

/**
 * Saves the current ISO date/time to the file.
 */
function saveLastSyncTime() {
  const syncData = {
    lastSync: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(syncData, null, 2));
    console.log("Sync time updated to:", syncData.lastSync);
  } catch (error) {
    console.error("Failed to save sync time:", error);
  }
}

function convertAustralianFormat(phone) {
  if (!phone) {
    return null;
  }
  const rawPhone = phone;

  // 1. Remove all spaces and non-digit characters
  // let cleaned = rawPhone;
  let cleaned = rawPhone.replace(/\D/g, "");

  // 2. Replace leading '0' with '+61'
  if (cleaned.startsWith("0")) {
    cleaned = "+61" + cleaned.substring(1);
  } else if (!cleaned.startsWith("61")) {
    // Optional: Add +61 if it's missing entirely
    cleaned = "+61" + cleaned;
  }

  return cleaned;
}

let task_client = null;

function taskClient() {
  if (task_client) return task_client;

  const client = getHubspotClient();

  task_client = client.customObject("tasks");

  return task_client;
}

/**
 * universal-needs-update.js
 * Compares a local payload against a HubSpot record to prevent redundant API calls.
 */
function needsUpdate(payload, existingRecord, objectType = "Object") {
  if (!existingRecord || !existingRecord.properties) return true;

  const newProps = payload?.properties || payload || {};
  const oldProps = existingRecord.properties;

  const changes = Object.keys(newProps).filter((key) => {
    const newVal = newProps[key];
    const oldVal = oldProps[key];

    // Normalize values to strings for comparison
    // HubSpot returns null/undefined/empty string differently depending on the property type
    const normalizedNew =
      newVal === null || newVal === undefined ? "" : String(newVal).trim();
    const normalizedOld =
      oldVal === null || oldVal === undefined ? "" : String(oldVal).trim();

    // Special logic for Dates (HubSpot timestamps can vary in precision)
    if (key.endsWith("_date") || key.includes("timestamp")) {
      const d1 = Date.parse(normalizedNew);
      const d2 = Date.parse(normalizedOld);
      if (!isNaN(d1) && !isNaN(d2)) return d1 !== d2;
    }

    return normalizedNew !== normalizedOld;
  });

  if (changes.length > 0) {
    console.info(
      `[Idempotency] ${objectType} change detected in: ${changes.join(", ")}`
    );
    return true;
  }

  return false;
}

function taskProperties() {
  return [
    "hs_object_id",
    "service_m8_uuid",
    "hs_task_subject",
    "hs_task_status",
    "hs_task_reminders",
    "hs_task_recurrence",
    "hs_repeat_status",
    "hs_task_repeat_interval",
    "hs_repeat_status",
    "hs_task_repeat_interval",
  ];
}

export {
  taskProperties,
  needsUpdate,
  convertAustralianFormat,
  companyProperties,
  delta,
  currentDate,
  contactProperties,
  dealProperties,
  cleanProps,
  getLastSyncTime,
  saveLastSyncTime,
  taskClient,
};
