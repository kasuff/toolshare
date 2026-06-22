import { z } from "@toolshare/shared";
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
extendZodWithOpenApi(z);

import * as yaml from "yaml";
import * as fs from "fs";
import {
  createToolBodySchema, updateToolBodySchema, listToolsQuerySchema
} from "@toolshare/shared/contracts/request/tools.schema";
import {
  createToolBookingBodySchema, updateBookingStatusBodySchema
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

// Bookings
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
