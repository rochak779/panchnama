import { describe, expect, it } from "vitest";
import { isBlockedIpAddress } from "./ip-range.js";

describe("isBlockedIpAddress", () => {
  it("blocks loopback", () => {
    expect(isBlockedIpAddress("127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("::1")).toBe(true);
  });

  it("blocks private ranges", () => {
    expect(isBlockedIpAddress("10.1.2.3")).toBe(true);
    expect(isBlockedIpAddress("172.16.0.5")).toBe(true);
    expect(isBlockedIpAddress("172.31.255.255")).toBe(true);
    expect(isBlockedIpAddress("192.168.1.1")).toBe(true);
  });

  it("blocks link-local incl. metadata service", () => {
    expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
    expect(isBlockedIpAddress("169.254.0.1")).toBe(true);
  });

  it("blocks IPv6 link-local and unique-local", () => {
    expect(isBlockedIpAddress("fe80::1")).toBe(true);
    expect(isBlockedIpAddress("fc00::1")).toBe(true);
    expect(isBlockedIpAddress("fd12:3456::1")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 addresses embedding a blocked IPv4", () => {
    expect(isBlockedIpAddress("::ffff:127.0.0.1")).toBe(true);
  });

  it("allows ordinary public IPv4/IPv6 addresses", () => {
    expect(isBlockedIpAddress("8.8.8.8")).toBe(false);
    expect(isBlockedIpAddress("93.184.216.34")).toBe(false);
    expect(isBlockedIpAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("172.15.x and 172.32.x are outside the 172.16/12 private range", () => {
    expect(isBlockedIpAddress("172.15.0.1")).toBe(false);
    expect(isBlockedIpAddress("172.32.0.1")).toBe(false);
  });

  it("fails closed on unparsable input", () => {
    expect(isBlockedIpAddress("not-an-ip")).toBe(true);
  });
});
