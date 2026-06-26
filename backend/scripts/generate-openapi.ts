import { z } from "@toolshare/shared";
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
extendZodWithOpenApi(z);

import * as yaml from "yaml";
import * as fs from "fs";
import {
  createToolBodySchema, updateToolBodySchema, listToolsQuerySchema
} from "@toolshare/shared/contracts/request/tools.schema";
import {
  createToolBookingBodySchema,
  createToolOwnerBlockBodySchema,
  createWorkshopBookingBodySchema,
  updateBookingStatusBodySchema,
  createPickupProposalBodySchema,
  respondPickupProposalBodySchema,
  createTimeslotProposalBodySchema,
  respondTimeslotProposalBodySchema
} from "@toolshare/shared/contracts/request/bookings.schema";
import { loginBodySchema } from "@toolshare/shared/contracts/request/auth.schema";
import {
  toolResponseSchema,
  toolListResponseSchema,
  toolBlockingPeriodListResponseSchema,
  toolOwnerBlockListResponseSchema
} from "@toolshare/shared/contracts/response/tools.schema";
import {
  bookingResponseSchema,
  bookingListResponseSchema,
  bookingPickupProposalResponseSchema,
  bookingTimeslotProposalResponseSchema
} from "@toolshare/shared/contracts/response/bookings.schema";
import {
  workshopResponseSchema,
  workshopListResponseSchema,
  workshopTimeslotResponseSchema
} from "@toolshare/shared/contracts/response/workshops.schema";
import {
  userResponseSchema,
  userListResponseSchema,
  adminMetricsResponseSchema
} from "@toolshare/shared/contracts/response/users.schema";
import {
  authResponseSchema,
  refreshResponseSchema
} from "@toolshare/shared/contracts/response/auth.schema";
import {
  ratingResponseSchema,
  ratingListResponseSchema,
  publicRatingListResponseSchema
} from "@toolshare/shared/contracts/response/ratings.schema";
import {
  moderationReportResponseSchema,
  moderationReportListResponseSchema
} from "@toolshare/shared/contracts/response/moderation.schema";
import { notificationListResponseSchema } from "@toolshare/shared/contracts/response/notifications.schema";
import { systemSettingListResponseSchema } from "@toolshare/shared/contracts/response/system-rules.schema";
import {
  addressSuggestionsResponseSchema,
  addressValidationResponseSchema
} from "@toolshare/shared/contracts/response/address.schema";
import { problemDetailsSchema } from "@toolshare/shared/contracts/errors/problem.schema";

const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// Response-Schemas als wiederverwendbare Komponenten registrieren (ADR-013).
const ToolResponse = registry.register("ToolResponse", toolResponseSchema);
const ToolListResponse = registry.register("ToolListResponse", toolListResponseSchema);
const ToolBlockingPeriodListResponse = registry.register(
  "ToolBlockingPeriodListResponse",
  toolBlockingPeriodListResponseSchema
);
const ToolOwnerBlockListResponse = registry.register(
  "ToolOwnerBlockListResponse",
  toolOwnerBlockListResponseSchema
);
const BookingResponse = registry.register("BookingResponse", bookingResponseSchema);
const BookingListResponse = registry.register("BookingListResponse", bookingListResponseSchema);
const BookingPickupProposalResponse = registry.register(
  "BookingPickupProposalResponse",
  bookingPickupProposalResponseSchema
);
const BookingTimeslotProposalResponse = registry.register(
  "BookingTimeslotProposalResponse",
  bookingTimeslotProposalResponseSchema
);
const WorkshopResponse = registry.register("WorkshopResponse", workshopResponseSchema);
const WorkshopListResponse = registry.register("WorkshopListResponse", workshopListResponseSchema);
const WorkshopTimeslotResponse = registry.register(
  "WorkshopTimeslotResponse",
  workshopTimeslotResponseSchema
);
const UserResponse = registry.register("UserResponse", userResponseSchema);
const UserListResponse = registry.register("UserListResponse", userListResponseSchema);
const AdminMetricsResponse = registry.register("AdminMetricsResponse", adminMetricsResponseSchema);
const AuthResponse = registry.register("AuthResponse", authResponseSchema);
const RefreshResponse = registry.register("RefreshResponse", refreshResponseSchema);
const RatingResponse = registry.register("RatingResponse", ratingResponseSchema);
const RatingListResponse = registry.register("RatingListResponse", ratingListResponseSchema);
const PublicRatingListResponse = registry.register(
  "PublicRatingListResponse",
  publicRatingListResponseSchema
);
const ModerationReportResponse = registry.register(
  "ModerationReportResponse",
  moderationReportResponseSchema
);
const ModerationReportListResponse = registry.register(
  "ModerationReportListResponse",
  moderationReportListResponseSchema
);
const NotificationListResponse = registry.register(
  "NotificationListResponse",
  notificationListResponseSchema
);
const SystemSettingListResponse = registry.register(
  "SystemSettingListResponse",
  systemSettingListResponseSchema
);
const AddressSuggestionsResponse = registry.register(
  "AddressSuggestionsResponse",
  addressSuggestionsResponseSchema
);
const AddressValidationResponse = registry.register(
  "AddressValidationResponse",
  addressValidationResponseSchema
);
const ProblemDetails = registry.register("ProblemDetails", problemDetailsSchema);

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });

// Auth
registry.registerPath({
  method: "post",
  path: "/auth/login",
  summary: "Login",
  request: {
    body: { content: { "application/json": { schema: loginBodySchema } } }
  },
  responses: {
    200: { description: "JWT tokens", ...json(AuthResponse) },
    401: { description: "Invalid credentials", ...json(ProblemDetails) }
  }
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  summary: "Refresh access token",
  responses: {
    200: { description: "Refreshed tokens", ...json(RefreshResponse) },
    401: { description: "Invalid refresh token", ...json(ProblemDetails) }
  }
});

// Tools
registry.registerPath({
  method: "post",
  path: "/tools",
  summary: "Create tool",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: createToolBodySchema } } }
  },
  responses: { 201: { description: "Created tool", ...json(ToolResponse) } }
});

registry.registerPath({
  method: "get",
  path: "/tools",
  summary: "List tools",
  request: { query: listToolsQuerySchema },
  responses: { 200: { description: "Tool list", ...json(ToolListResponse) } }
});

registry.registerPath({
  method: "get",
  path: "/tools/{id}",
  summary: "Get tool by ID",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "Tool details", ...json(ToolResponse) },
    404: { description: "Not found", ...json(ProblemDetails) }
  }
});

registry.registerPath({
  method: "get",
  path: "/tools/{id}/blocking-periods",
  summary: "List blocking periods for tool",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: "Blocking periods list", ...json(ToolBlockingPeriodListResponse) } }
});

registry.registerPath({
  method: "get",
  path: "/tools/{id}/owner-blocks",
  summary: "List owner blocks for tool",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: "Owner blocks list", ...json(ToolOwnerBlockListResponse) } }
});

registry.registerPath({
  method: "delete",
  path: "/tools/{id}/owner-blocks/{bookingId}",
  summary: "Delete owner block for tool",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid(), bookingId: z.string().uuid() }) },
  responses: { 204: { description: "Deleted owner block" } }
});

registry.registerPath({
  method: "patch",
  path: "/tools/{id}",
  summary: "Update tool",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { "application/json": { schema: updateToolBodySchema } } }
  },
  responses: { 200: { description: "Updated tool", ...json(ToolResponse) } }
});

registry.registerPath({
  method: "delete",
  path: "/tools/{id}",
  summary: "Delete tool",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 204: { description: "Deleted tool" } }
});

// Bookings
registry.registerPath({
  method: "get",
  path: "/bookings/me",
  summary: "List my bookings",
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: "My bookings list", ...json(BookingListResponse) } }
});

registry.registerPath({
  method: "post",
  path: "/bookings/tool",
  summary: "Create tool booking",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: createToolBookingBodySchema } } }
  },
  responses: {
    201: { description: "Booking created", ...json(BookingResponse) },
    409: { description: "Conflict", ...json(ProblemDetails) }
  }
});

registry.registerPath({
  method: "post",
  path: "/bookings/tool-owner-block",
  summary: "Create tool owner block",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: createToolOwnerBlockBodySchema } } }
  },
  responses: {
    201: { description: "Owner block created", ...json(BookingResponse) },
    409: { description: "Conflict", ...json(ProblemDetails) }
  }
});

registry.registerPath({
  method: "post",
  path: "/bookings/workshop",
  summary: "Create workshop booking",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: createWorkshopBookingBodySchema } } }
  },
  responses: {
    201: { description: "Workshop booking created", ...json(BookingResponse) },
    409: { description: "Conflict", ...json(ProblemDetails) }
  }
});

registry.registerPath({
  method: "post",
  path: "/bookings/{id}/pickup-proposals",
  summary: "Create pickup proposal",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { "application/json": { schema: createPickupProposalBodySchema } } }
  },
  responses: { 201: { description: "Pickup proposal created", ...json(BookingPickupProposalResponse) } }
});

registry.registerPath({
  method: "patch",
  path: "/bookings/{id}/pickup-proposals/{proposalId}",
  summary: "Respond to pickup proposal",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid(), proposalId: z.string().uuid() }),
    body: { content: { "application/json": { schema: respondPickupProposalBodySchema } } }
  },
  responses: { 200: { description: "Responded to pickup proposal", ...json(BookingPickupProposalResponse) } }
});

registry.registerPath({
  method: "post",
  path: "/bookings/{id}/timeslot-proposals",
  summary: "Create timeslot proposal",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { "application/json": { schema: createTimeslotProposalBodySchema } } }
  },
  responses: { 201: { description: "Timeslot proposal created", ...json(BookingTimeslotProposalResponse) } }
});

registry.registerPath({
  method: "patch",
  path: "/bookings/{id}/timeslot-proposals/{proposalId}",
  summary: "Respond to timeslot proposal",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid(), proposalId: z.string().uuid() }),
    body: { content: { "application/json": { schema: respondTimeslotProposalBodySchema } } }
  },
  responses: { 200: { description: "Responded to timeslot proposal", ...json(BookingTimeslotProposalResponse) } }
});

registry.registerPath({
  method: "patch",
  path: "/bookings/{id}/status",
  summary: "Update booking status",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { "application/json": { schema: updateBookingStatusBodySchema } } }
  },
  responses: { 200: { description: "Status updated", ...json(BookingResponse) } }
});

// Workshops
registry.registerPath({
  method: "get",
  path: "/workshops",
  summary: "List workshops",
  responses: { 200: { description: "Workshop list", ...json(WorkshopListResponse) } }
});

registry.registerPath({
  method: "get",
  path: "/workshops/{id}",
  summary: "Get workshop by ID",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "Workshop details", ...json(WorkshopResponse) },
    404: { description: "Not found", ...json(ProblemDetails) }
  }
});

registry.registerPath({
  method: "post",
  path: "/workshops/{id}/timeslots",
  summary: "Create workshop timeslot",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 201: { description: "Timeslot created", ...json(WorkshopTimeslotResponse) } }
});

// Users
registry.registerPath({
  method: "get",
  path: "/users",
  summary: "List users",
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: "User list", ...json(UserListResponse) } }
});

registry.registerPath({
  method: "get",
  path: "/users/me",
  summary: "Get my profile",
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: "My profile", ...json(UserResponse) } }
});

registry.registerPath({
  method: "get",
  path: "/users/{id}",
  summary: "Get user by ID",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "User details", ...json(UserResponse) },
    404: { description: "Not found", ...json(ProblemDetails) }
  }
});

registry.registerPath({
  method: "get",
  path: "/users/admin/metrics",
  summary: "Get admin metrics",
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: "Admin metrics", ...json(AdminMetricsResponse) } }
});

// Ratings
registry.registerPath({
  method: "get",
  path: "/ratings/me/received",
  summary: "List ratings received",
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: "Ratings received", ...json(RatingListResponse) } }
});

registry.registerPath({
  method: "get",
  path: "/ratings/me/given",
  summary: "List ratings given",
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: "Ratings given", ...json(RatingListResponse) } }
});

registry.registerPath({
  method: "get",
  path: "/ratings/tools/{toolId}",
  summary: "List public ratings for a tool",
  request: { params: z.object({ toolId: z.string().uuid() }) },
  responses: { 200: { description: "Public tool ratings", ...json(PublicRatingListResponse) } }
});

registry.registerPath({
  method: "get",
  path: "/ratings/workshops/{workshopId}",
  summary: "List public ratings for a workshop",
  request: { params: z.object({ workshopId: z.string().uuid() }) },
  responses: { 200: { description: "Public workshop ratings", ...json(PublicRatingListResponse) } }
});

registry.registerPath({
  method: "post",
  path: "/ratings",
  summary: "Create rating",
  security: [{ bearerAuth: [] }],
  responses: { 201: { description: "Rating created", ...json(RatingResponse) } }
});

// Moderation
registry.registerPath({
  method: "get",
  path: "/moderation/reports",
  summary: "List open moderation reports",
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: "Open reports", ...json(ModerationReportListResponse) } }
});

registry.registerPath({
  method: "get",
  path: "/moderation/reports/closed",
  summary: "List closed moderation reports",
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: "Closed reports", ...json(ModerationReportListResponse) } }
});

registry.registerPath({
  method: "post",
  path: "/moderation/reports",
  summary: "Create moderation report",
  security: [{ bearerAuth: [] }],
  responses: { 201: { description: "Report created", ...json(ModerationReportResponse) } }
});

// Notifications
registry.registerPath({
  method: "get",
  path: "/notifications/me",
  summary: "List my notifications",
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: "Notifications", ...json(NotificationListResponse) } }
});

// System rules
registry.registerPath({
  method: "get",
  path: "/system-rules",
  summary: "List enforced system settings",
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: "System settings", ...json(SystemSettingListResponse) } }
});

// Address
registry.registerPath({
  method: "get",
  path: "/address/suggest",
  summary: "Suggest addresses",
  request: { query: z.object({ q: z.string() }) },
  responses: { 200: { description: "Address suggestions", ...json(AddressSuggestionsResponse) } }
});

registry.registerPath({
  method: "get",
  path: "/address/validate",
  summary: "Validate an address",
  request: { query: z.object({ q: z.string() }) },
  responses: { 200: { description: "Validation result", ...json(AddressValidationResponse) } }
});

const generator = new OpenApiGeneratorV31(registry.definitions);
const document = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    version: "0.1.0",
    title: "ToolShare API",
    description:
      "REST API contract for ToolShare (auth, tools, bookings, workshops, users, ratings, moderation, notifications, system-rules & address). Response payloads are derived from the shared Zod response contracts (ADR-013)."
  },
  servers: [{ url: "http://localhost:4000/api" }]
});

fs.writeFileSync("openapi.yaml", yaml.stringify(document));
console.log("openapi.yaml generated successfully!");
