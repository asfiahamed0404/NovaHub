import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedClientOrigin } from "../../utils/clientOrigin.js";

const configured = "http://localhost:5173";

test("development accepts localhost and loopback aliases on the configured port", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.equal(isAllowedClientOrigin(`http://${host}:5173`, configured, "development"), true);
  }
  assert.equal(isAllowedClientOrigin(configured, "http://127.0.0.1:5173", "development"), true);
});

test("development rejects unrelated origins, ports, and malformed origins", () => {
  for (const origin of [
    "http://127.0.0.1:5174",
    "https://127.0.0.1:5173",
    "http://localhost.evil.test:5173",
    "http://192.168.1.2:5173",
    "http://127.0.0.1:5173/path",
    "http://user@127.0.0.1:5173",
    "null",
  ]) {
    assert.equal(isAllowedClientOrigin(origin, configured, "development"), false, origin);
  }
});

test("production requires the exact configured origin even for loopback hosts", () => {
  assert.equal(isAllowedClientOrigin(configured, configured, "production"), true);
  assert.equal(isAllowedClientOrigin("http://127.0.0.1:5173", configured, "production"), false);
  assert.equal(isAllowedClientOrigin(configured, "https://nova-hub-sage.vercel.app", "production"), false);
});

test("a remote configured origin never enables loopback aliases", () => {
  assert.equal(isAllowedClientOrigin(configured, "https://nova-hub-sage.vercel.app", "development"), false);
  assert.equal(isAllowedClientOrigin(configured, "", "development"), false);
});

test("requests without an Origin header retain existing access", () => {
  assert.equal(isAllowedClientOrigin(undefined, configured, "production"), true);
});
