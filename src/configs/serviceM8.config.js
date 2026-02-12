import axios from "axios";

const apiKey = process.env.SERVICEM8_API_KEY;
const baseURL = process.env.SERVICEM8_BASE_URL;
// ServiceM8 often expects: username = email/apikey, password = password
// For API keys, it's often: username = apikey, password = empty
const token = Buffer.from(`${apiKey}:`).toString();
const base_url = Buffer.from(`${baseURL}`).toString();

const serviceM8Client = axios.create({
  baseURL: "https://api.servicem8.com/api_1.0/",
  // baseURL: base_url,
  headers: {
    accept: "application/json",
    "X-Api-Key": "smk-d00d83-847d3c719c0251ba-75bc01bf149c6bdc",
  },
});

export { serviceM8Client };
