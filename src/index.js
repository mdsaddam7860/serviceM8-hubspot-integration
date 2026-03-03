import { logger } from "./utils/winston.logger.js";
import { axiosInstance, hubspotClient } from "./configs/hubspot.config.js";
import {
  Throttle,
  throttle,
  withRetry,
  isRetryableError,
  createRequestExecutor,
} from "./utils/requestExecutor.js";

// -----------------------------------Hubspot Mapping Functions-----------------------------------------
import {
  contactMappingSM8ToHS,
  dealMappingSM8ToHS,
  activityMappingSM8ToHS,
  companyMappingSM8ToHS,
} from "./mappings/hubspot.mapping.js"; // Hubspot Mapping functions

// -----------------------------------serviceM8 Mapping Functions-----------------------------------------
import {
  clientMappingHSTOSM8,
  contactMappingHSTOSM8,
  companyMappingHSTOSM8,
  jobMappingHSTOSM8,
  companyContactMappingHSTOSM8,
  jobContactMappingHSTOSM8,
} from "./mappings/serviceM8.mapping.js"; // serviceM8 Mapping functions

// -----------------------------------Helper Functions-----------------------------------------

import {
  delta,
  currentDate,
  contactProperties,
  dealProperties,
  companyProperties,
  cleanProps,
  convertAustralianFormat,
} from "./utils/helper.util.js"; // Helper functions

// ------------------------------------------------Hubspot Services-----------------------------------------
import {
  searchInHubspot,
  fetchHubSpotAssociationIds,
} from "./services/hubspot.service.js"; // Hubspot Services

export {
  jobContactMappingHSTOSM8,
  companyContactMappingHSTOSM8,
  fetchHubSpotAssociationIds,
  contactMappingHSTOSM8,
  companyMappingHSTOSM8,
  convertAustralianFormat,
  companyMappingSM8ToHS,
  companyProperties,
  cleanProps,
  clientMappingHSTOSM8,
  dealProperties,
  jobMappingHSTOSM8,
  contactProperties,
  logger,
  delta,
  axiosInstance,
  hubspotClient,
  Throttle,
  currentDate,
  throttle,
  withRetry,
  isRetryableError,
  createRequestExecutor,
  contactMappingSM8ToHS,
  dealMappingSM8ToHS,
  activityMappingSM8ToHS,
  searchInHubspot,
};
