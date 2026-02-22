// src/lib/xeroAuthClient.ts
import { XeroClient } from "xero-node";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function getXeroClient() {
  const clientId = mustEnv("XERO_CLIENT_ID");
  const clientSecret = mustEnv("XERO_CLIENT_SECRET");
  const redirectUri = mustEnv("XERO_REDIRECT_URI");

  return new XeroClient({
    clientId,
    clientSecret,
    redirectUris: [redirectUri],
    scopes: [
      "offline_access",
      "accounting.transactions",
      "accounting.contacts",
      "accounting.settings",
    ],
  } as any);
}
