import express from "express";

import { HubspotToServiceM8Sync } from "./services/hubspot.service.js";
import { ServiceM8ToHubspotSync } from "./services/serviceM8.service.js";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running............");
});

app.get("/health", (req, res) => {
  res.status(200).send("Server is running............");
});

app.post("/startDualSync", (req, res) => {
  res.status(200).send("Bi-Directional Sync Started..........");

  HubspotToServiceM8Sync();
  ServiceM8ToHubspotSync();
});

export default app;
