import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySubstratalSignature } from "@/lib/webhook";

const SECRET = "whsec_test_secret";
const BODY = '{"id":"wev_1","type":"access.revoked","data":{"user_id":"usr_1"}}';
const NOW = 1_730_649_761_000;
const T = NOW / 1000;

function sign(secret: string, t: number, body: string): string {
  return createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
}

describe("verifySubstratalSignature", () => {
  it("accepts a valid signature", () => {
    const header = `t=${T},v1=${sign(SECRET, T, BODY)}`;
    expect(verifySubstratalSignature(header, BODY, [SECRET], NOW)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const header = `t=${T},v1=${sign(SECRET, T, BODY)}`;
    expect(verifySubstratalSignature(header, BODY.replace("usr_1", "usr_2"), [SECRET], NOW)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const header = `t=${T},v1=${sign("whsec_other", T, BODY)}`;
    expect(verifySubstratalSignature(header, BODY, [SECRET], NOW)).toBe(false);
  });

  it("rejects deliveries older than 5 minutes (replays)", () => {
    const old = T - 301;
    const header = `t=${old},v1=${sign(SECRET, old, BODY)}`;
    expect(verifySubstratalSignature(header, BODY, [SECRET], NOW)).toBe(false);
  });

  it("accepts either signature during a secret rotation", () => {
    const header = `t=${T},v1=${sign("whsec_new", T, BODY)},v1=${sign(SECRET, T, BODY)}`;
    expect(verifySubstratalSignature(header, BODY, [SECRET], NOW)).toBe(true);
    expect(verifySubstratalSignature(header, BODY, ["whsec_new"], NOW)).toBe(true);
  });

  it("rejects missing or malformed headers and an empty secret list", () => {
    expect(verifySubstratalSignature(null, BODY, [SECRET], NOW)).toBe(false);
    expect(verifySubstratalSignature("garbage", BODY, [SECRET], NOW)).toBe(false);
    expect(verifySubstratalSignature(`t=${T},v1=zz`, BODY, [SECRET], NOW)).toBe(false);
    expect(verifySubstratalSignature(`t=${T},v1=${sign(SECRET, T, BODY)}`, BODY, [], NOW)).toBe(false);
  });
});
