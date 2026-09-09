import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { need, sandbox } from "./db";
const state = globalThis as typeof globalThis & { bdosSandboxSecret?: string };
function secret() {
  if (process.env.AUTH_SECRET) {
    need(
      process.env.AUTH_SECRET.length >= 32,
      "AUTH_SECRET must be at least 32 characters",
      503,
    );
    return process.env.AUTH_SECRET;
  }
  need(sandbox(), "AUTH_SECRET is required outside the sandbox", 503);
  return (state.bdosSandboxSecret ??= randomBytes(32).toString("hex"));
}
export const sign = (value: string) =>
  createHmac("sha256", secret()).update(value).digest("hex");
export const otpHash = (phone: string, code: string) =>
  sign(`otp:${phone}:${code}`);
export function adToken(userId: string, campaignId: string) {
  const value = `${userId}:${campaignId}:${Date.now() + 1800000}`;
  return `${Buffer.from(value).toString("base64url")}.${sign(`placement:${value}`)}`;
}
export function verifyAdToken(
  token: string,
  userId: string,
  campaignId: string,
) {
  const [body, signature] = token.split(".");
  need(body && signature, "Load this ad from the feed first", 403);
  const value = Buffer.from(body, "base64url").toString();
  const expected = sign(`placement:${value}`);
  need(
    signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected)),
    "Invalid ad placement",
    403,
  );
  const [user, campaign, expires] = value.split(":");
  need(
    user === userId && campaign === campaignId && Number(expires) > Date.now(),
    "Ad placement has expired",
    403,
  );
}
export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}
export function smsProvider(): SmsProvider {
  if (sandbox()) return { async sendOtp() {} };
  return {
    async sendOtp(phone, code) {
      const url = process.env.SMS_WEBHOOK_URL;
      const token = process.env.SMS_WEBHOOK_TOKEN;
      need(
        url && token && url.startsWith("https://"),
        "Configure an HTTPS SMS_WEBHOOK_URL and SMS_WEBHOOK_TOKEN",
        503,
      );
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: phone,
          message: `Your BDOS code is ${code}. It expires in 5 minutes.`,
        }),
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      need(
        response.ok,
        "The SMS provider could not deliver a code. Please retry.",
        503,
      );
    },
  };
}
