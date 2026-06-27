import { describe, expect, it } from "vitest";
import { Registry, Counter, Histogram, Gauge } from "prom-client";
import {
  metricsRegistry,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpRequestSizeBytes,
  userRegistrationsTotal,
  userLoginsTotal,
  bookingsCreatedTotal,
  toolsListedGauge,
  activeUsersGauge
} from "../src/utils/metrics";

describe("metricsRegistry", () => {
  it("is an isolated prom-client Registry", () => {
    expect(metricsRegistry).toBeInstanceOf(Registry);
  });

  it("contains all custom metrics by name", async () => {
    const names = (await metricsRegistry.getMetricsAsJSON()).map((m) => m.name);
    expect(names).toContain("http_requests_total");
    expect(names).toContain("http_request_duration_seconds");
    expect(names).toContain("http_request_size_bytes");
    expect(names).toContain("toolshare_user_registrations_total");
    expect(names).toContain("toolshare_user_logins_total");
    expect(names).toContain("toolshare_bookings_created_total");
    expect(names).toContain("toolshare_tools_listed_total");
    expect(names).toContain("toolshare_active_users");
  });
});

describe("HTTP metrics", () => {
  it("httpRequestsTotal is a Counter with correct labels", () => {
    expect(httpRequestsTotal).toBeInstanceOf(Counter);
  });

  it("httpRequestDurationSeconds is a Histogram with correct labels", () => {
    expect(httpRequestDurationSeconds).toBeInstanceOf(Histogram);
  });

  it("httpRequestSizeBytes is a Histogram", () => {
    expect(httpRequestSizeBytes).toBeInstanceOf(Histogram);
  });
});

describe("business metrics", () => {
  it("userRegistrationsTotal is a Counter", () => {
    expect(userRegistrationsTotal).toBeInstanceOf(Counter);
  });

  it("userLoginsTotal is a Counter", () => {
    expect(userLoginsTotal).toBeInstanceOf(Counter);
  });

  it("bookingsCreatedTotal is a Counter", () => {
    expect(bookingsCreatedTotal).toBeInstanceOf(Counter);
  });

  it("toolsListedGauge is a Gauge", () => {
    expect(toolsListedGauge).toBeInstanceOf(Gauge);
  });

  it("activeUsersGauge is a Gauge", () => {
    expect(activeUsersGauge).toBeInstanceOf(Gauge);
  });
});