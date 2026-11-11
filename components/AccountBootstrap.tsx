"use client";

// Mounted once in the root layout: loads the signed-in session (if any) so
// saved favorites and the account's theme apply on every page. A no-op unless
// accounts are enabled.

import { useEffect } from "react";
import { useAccount } from "@/lib/account";
import { clientConfig } from "@/lib/clientConfig";

export default function AccountBootstrap() {
  useEffect(() => {
    if (clientConfig.accountsEnabled) useAccount.getState().init();
  }, []);
  return null;
}
