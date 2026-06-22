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

const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// Auth
registry.registerPath({
  method: "post",
  path: "/auth/login",
  summary: "Login",
  request: {
    body: { content: { "application/json": { schema: loginBodySchema } } }
  },
  responses: { 200: { description: "JWT tokens" } }
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
  responses: { 201: { description: "Created tool" } }
});

registry.registerPath({
  method: "get",
  path: "/tools",
  summary: "List tools",
  request: { query: listToolsQuerySchema },
  responses: { 200: { description: "Tool list" } }
});

registry.registerPath({
  method: "get",
  path: "/tools/{id}",
  summary: "Get tool by ID",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: "Tool details" }, 404: { description: "Not found" } }
});

registry.registerPath({
  method: "get",
  path: "/tools/{id}/blocking-periods",
  summary: "List blocking periods for tool",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: "Blocking periods list" } }
});

registry.registerPath({
  method: "get",
  path: "/tools/{id}/owner-blocks",
  summary: "List owner blocks for tool",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: "Owner blocks list" } }
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
  responses: { 200: { description: "Updated tool" } }
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
  responses: { 200: { description: "My bookings list" } }
});

registry.registerPath({
  method: "post",
  path: "/bookings/tool",
  summary: "Create tool booking",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: createToolBookingBodySchema } } }
  },
  responses: { 201: { description: "Booking created" }, 409: { description: "Conflict" } }
});

registry.registerPath({
  method: "post",
  path: "/bookings/tool-owner-block",
  summary: "Create tool owner block",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: createToolOwnerBlockBodySchema } } }
  },
  responses: { 201: { description: "Owner block created" }, 409: { description: "Conflict" } }
});

registry.registerPath({
  method: "post",
  path: "/bookings/workshop",
  summary: "Create workshop booking",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: createWorkshopBookingBodySchema } } }
  },
  responses: { 201: { description: "Workshop booking created" }, 409: { description: "Conflict" } }
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
  responses: { 201: { description: "Pickup proposal created" } }
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
  responses: { 200: { description: "Responded to pickup proposal" } }
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
  responses: { 201: { description: "Timeslot proposal created" } }
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
  responses: { 200: { description: "Responded to timeslot proposal" } }
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
  responses: { 200: { description: "Status updated" } }
});

const generator = new OpenApiGeneratorV31(registry.definitions);
const document = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    version: "0.1.0",
    title: "ToolShare API",
    description: "REST API contract for ToolShare (subset — auth, tools & bookings)"
  },
  servers: [{ url: "http://localhost:4000/api" }]
});

fs.writeFileSync("openapi.yaml", yaml.stringify(document));
console.log("openapi.yaml generated successfully!");
