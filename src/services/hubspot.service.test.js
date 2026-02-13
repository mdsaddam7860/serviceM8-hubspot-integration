import { describe, test, expect, jest } from "@jest/globals";
import { hubspotGenerator, syncContact } from "./hubspot.service.js";
describe("hubspotGenerator", () => {
  test("yields one page correctly", async () => {
    const mockAxios = {
      get: jest.fn().mockResolvedValue({
        data: {
          results: [{ id: 1 }, { id: 2 }],
          paging: {},
        },
      }),
    };

    const mockExecutor = jest.fn((fn) => fn());

    const generator = hubspotGenerator("/crm/v3/objects/contacts", {
      axiosInstance: mockAxios,
      executor: mockExecutor,
      log: { info: jest.fn(), error: jest.fn() },
    });

    const results = [];

    for await (const page of generator) {
      results.push(page);
    }

    expect(results).toHaveLength(1);
    expect(results[0].records).toHaveLength(2);
    expect(results[0].stats.page).toBe(1);
  });
});

// import * as service from "./hubspot.service.js";

// test("syncContact processes batches", async () => {
//   const mockGenerator = async function* () {
//     yield {
//       records: [{ id: 1 }],
//       stats: { totalProcessed: 1, elapsedSeconds: 1, recordsPerSecond: "1.00" },
//     };
//   };

//   jest.spyOn(service, "hubspotGenerator").mockReturnValue(mockGenerator());

//   await service.syncContact();
// });

// import { describe, test, expect, jest } from "@jest/globals";

// jest.unstable_mockModule("./hubspot.service.js", () => ({
//   hubspotGenerator: async function* () {
//     yield {
//       records: [{ id: 1 }],
//       stats: {
//         totalProcessed: 1,
//         elapsedSeconds: 1,
//         recordsPerSecond: "1.00",
//       },
//     };
//   },
//   syncContact: jest.requireActual("./hubspot.service.js").syncContact,
// }));

describe("syncContact", () => {
  test("consumes generator correctly", async () => {
    await syncContact({
      log: { info: jest.fn(), error: jest.fn() },
    });
  });
});
