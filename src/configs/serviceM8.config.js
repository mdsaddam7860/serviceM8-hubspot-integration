import axios from "axios";

const apiKey = process.env.SERVICEM8_API_KEY;
const baseURL = process.env.SERVICEM8_BASE_URL;
// ServiceM8 often expects: username = email/apikey, password = password
// For API keys, it's often: username = apikey, password = empty
const token = Buffer.from(`${apiKey}:`).toString();
const base_url = Buffer.from(`${baseURL}`).toString();

let serviceM8Client = null;

function getServiceM8Client() {
  if (serviceM8Client) return serviceM8Client;
  serviceM8Client = axios.create({
    baseURL: process.env.SERVICEM8_BASE_URL,
    // baseURL: "https://api.servicem8.com/api_1.0/",
    headers: {
      accept: "application/json",
      "X-Api-Key": process.env.SERVICEM8_API_KEY,
    },
  });

  return serviceM8Client;
}

export { serviceM8Client, getServiceM8Client };
