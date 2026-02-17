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
} from "./mappings/hubspot.mapping.js";

import { clientMappingHSTOSM8 } from "./mappings/serviceM8.mapping.js";
import {
  delta,
  currentDate,
  contactProperties,
  dealProperties,
  cleanProps,
} from "./utils/helper.util.js";
import { searchInHubspot } from "./services/hubspot.service.js";

export {
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
