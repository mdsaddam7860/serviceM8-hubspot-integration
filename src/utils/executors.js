import { createRequestExecutor } from "./requestExecutor.js";

const hubspotExecutor = createRequestExecutor({
  name: "HubSpot",
  rateLimit: 5, // Lowered to 5 for safety
  intervalMs: 1000,
  retries: 5, // Increased retries to handle temporary spikes
});

const serviceM8Executor = createRequestExecutor({
  name: "serviceM8",
  rateLimit: 2,
  intervalMs: 1000,
  retries: 4,
});

export { hubspotExecutor, serviceM8Executor };

/***!SECTION
 * 3. How you use it (this is the important part)
Axios call (Intermedia)
await intermediaExecutor(
  () => intermediaAxios(token).get(`users/${userId}/call-recordings`),
  { userId }
);

HubSpot update
await hubspotExecutor(
  () => hubspotClient.crm.contacts.basicApi.update(contactId, payload),
  { contactId }
);

Gong upload (your historic recordings sync)
await gongExecutor(
  () => uploadMediaToGong(recording),
  { recordingId: recording.id }
);
*/
