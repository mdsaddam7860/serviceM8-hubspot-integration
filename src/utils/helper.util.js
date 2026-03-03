function delta() {
  const date = new Date();
  date.setDate(date.getDate() - 9);

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

const filePath = `${process.cwd()}/lastSyncTime.json`;

function getLastSyncTime() {
  // get date and time one hour ago and save it into file
  console.log("CWD", process.cwd());
  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data);
}

function saveLastSyncTime() {
  const data = JSON.stringify(currentDate());
  fs.writeFileSync(filePath, data);
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

export {
  convertAustralianFormat,
  companyProperties,
  delta,
  currentDate,
  contactProperties,
  dealProperties,
  cleanProps,
  getLastSyncTime,
  saveLastSyncTime,
};
