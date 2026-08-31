import { describe, expect, it } from "vitest";
import { detectAuthWall, detectCaptchaOrBlock } from "./block-detect.js";

describe("detectAuthWall", () => {
  it("detects a login-path URL with a password field", () => {
    const result = detectAuthWall(
      `<html><body><form><input type="password" name="pw"></form></body></html>`,
      "https://portal.example/login",
    );
    expect(result.detected).toBe(true);
  });

  it("detects a page with both password and username fields regardless of URL", () => {
    const result = detectAuthWall(
      `<input id="username" type="text"><input type="password" name="pw">`,
      "https://portal.example/citizen-area",
    );
    expect(result.detected).toBe(true);
  });

  it("does not flag an ordinary content page", () => {
    const result = detectAuthWall(
      `<html><body><h1>Welcome</h1><p>Notices and updates.</p></body></html>`,
      "https://portal.example/notices",
    );
    expect(result.detected).toBe(false);
  });
});

describe("detectCaptchaOrBlock", () => {
  it("detects a reCAPTCHA widget", () => {
    const result = detectCaptchaOrBlock(`<div class="g-recaptcha" data-sitekey="abc"></div>`);
    expect(result.detected).toBe(true);
  });

  it("detects hCaptcha markup", () => {
    const result = detectCaptchaOrBlock(`<script src="https://hcaptcha.com/1/api.js"></script>`);
    expect(result.detected).toBe(true);
  });

  it("detects bot-block interstitial phrasing", () => {
    const result = detectCaptchaOrBlock(
      `<html><body><h1>Access Denied</h1><p>Please verify you are a human.</p></body></html>`,
    );
    expect(result.detected).toBe(true);
  });

  it("does not flag an ordinary content page", () => {
    const result = detectCaptchaOrBlock(
      `<html><body><h1>Welcome</h1><p>Public services directory.</p></body></html>`,
    );
    expect(result.detected).toBe(false);
  });
});
