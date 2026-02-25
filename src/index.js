import { logger } from "./utils/winston.logger.js";
import { axiosInstance, hubspotClient } from "./configs/hubspot.config.js";
import {
  Throttle,
  throttle,
  withRetry,
  isRetryableError,
  createRequestExecutor,
} from "./utils/requestExecutor.js";
import {
  contactMappingSM8ToHS,
  dealMappingSM8ToHS,
  activityMappingSM8ToHS,
  companyMappingSM8ToHS,
} from "./mappings/hubspot.mapping.js"; // Hubspot Mapping functions

import { clientMappingHSTOSM8 } from "./mappings/serviceM8.mapping.js"; // serviceM8 Mapping functions
import {
  delta,
  currentDate,
  contactProperties,
  dealProperties,
  companyProperties,
  cleanProps,
  convertAustralianFormat,
} from "./utils/helper.util.js"; // Helper functions
import { searchInHubspot } from "./services/hubspot.service.js"; // Hubspot Services

export {
  convertAustralianFormat,
  companyMappingSM8ToHS,
  companyProperties,
  cleanProps,
  clientMappingHSTOSM8,
  dealProperties,
  // jobMappingHSTOSM8,
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
