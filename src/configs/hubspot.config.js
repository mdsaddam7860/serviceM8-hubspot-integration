import { createClient } from "@mohammadsaddam-dev/hubspot-toolkit";
import axios from "axios";

let axiosInstance = null;
let hubspotClient = null;

function getHubspotClient() {
  if (hubspotClient) return hubspotClient;

  if (!hubspotClient && process.env.HUBSPOT_ACCESS_TOKEN) {
    hubspotClient = createClient({
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
      maxRetries: 0,
    });
  }
  return hubspotClient;
}

function getHSAxios() {
  if (axiosInstance) return axiosInstance;
  return (axiosInstance = axios.create({
    baseURL: "https://api.hubapi.com/",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    },
  }));
}

export { axiosInstance, hubspotClient, getHubspotClient, getHSAxios };
