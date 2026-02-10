import { createClient } from "@mohammadsaddam-dev/hubspot-toolkit";
import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "https://api.hubapi.com/",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
  },
});
let hubspotClient = null;

function getHubspotClient() {
  if (hubspotClient) return hubspotClient;

  if (!hubspotClient && process.env.HUBSPOT_ACCESS_TOKEN) {
    hubspotClient = createClient({
      apiKey: process.env.HUBSPOT_API_KEY, // or ACCESS TOKEN
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
    });
  }
  return hubspotClient;
}

export { axiosInstance, hubspotClient, getHubspotClient };
