import { setApiBaseUrl } from "./client";
import { authApi } from "./auth";
import { addressApi } from "./address";
import { usersApi } from "./users";
import { toolsApi } from "./tools";
import { workshopsApi } from "./workshops";
import { bookingsApi } from "./bookings";
import { notificationsApi } from "./notifications";
import { inboxApi } from "./inbox";
import { moderationApi } from "./moderation";
import { ratingsApi } from "./ratings";
import { adminApi } from "./admin";

export { setApiBaseUrl, request } from "./client";
export * from "./types";
export * from "./mappers/roles";

export const api = {
  ...authApi,
  ...addressApi,
  ...usersApi,
  ...toolsApi,
  ...workshopsApi,
  ...bookingsApi,
  ...notificationsApi,
  ...inboxApi,
  ...moderationApi,
  ...ratingsApi,
  ...adminApi
};
