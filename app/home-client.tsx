"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useActiveAccount,
  useActiveWalletChain,
  useProfiles,
} from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { client } from "@/lib/client";
import { SUPPORTED_CHAINS, DEFAULT_CHAIN } from "@/lib/chains";
import { upsertUser } from "@/components/dashboard/actions/user";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { SponsoredGasCard } from "@/components/dashboard/SponsoredGasCard";
import { TokenTable } from "@/components/dashboard/TokenTable";
import { TxTable } from "@/components/dashboard/TxTable";
import { Layout } from "@/components/layout/layout";

// EIP-7702: the user's EOA is the smart account — same address, no contract deployment.
export const wallets = [
  inAppWallet({
    auth: { options: ["google", "email", "passkey", "github"] },
    executionMode: {
      mode: "EIP7702",
      sponsorGas: true,
    },
  }),
];

export function HomeClient() {
  const account = useActiveAccount();
  const activeWalletChain = useActiveWalletChain();
  const { data: profiles } = useProfiles({ client });

  const [totalUSD, setTotalUSD] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);

  const upsertedRef = useRef<string | null>(null);

  // Create / update the user row in Supabase once per session per address.
  useEffect(() => {
    if (!account?.address || upsertedRef.current === account.address) return;
    upsertedRef.current = account.address;

    // Cast to string — AuthOption is a string-literal union, not plain string.
    const loginMethod = String(profiles?.[0]?.type ?? "unknown");
    upsertUser(account.address, loginMethod).catch(console.error);
  }, [account?.address, profiles]);

  const handleTotalChange = useCallback((usd: number) => {
    setTotalUSD(usd);
    setLoadingBalance(false);
  }, []);

  // Resolve active chain — fall back to default if the wallet is on an unsupported chain.
  const activeChain =
    SUPPORTED_CHAINS.find((c) => c.id === activeWalletChain?.id) ??
    DEFAULT_CHAIN;

  return (
    <Layout>

      <div className="flex flex-col min-h-screen">

        <main className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full space-y-6">
          {!account ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
              <h1 className="text-4xl font-bold text-ink">
                Welcome to Tango Wallet
              </h1>
              <p className="text-ink-dim max-w-md text-lg">
                Sign in to get a smart wallet. Every transaction you make is
                gas-sponsored — you never pay gas fees.
              </p>
              <p className="text-ink-faint text-sm">
                Click &ldquo;Connect&rdquo; in the top-right to get started.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <BalanceCard totalUSD={totalUSD} isLoading={loadingBalance} />
                <SponsoredGasCard address={account.address} />
              </div>

              <TokenTable
                address={account.address}
                chain={activeChain}
                onTotalChange={handleTotalChange}
              />

              <TxTable address={account.address} chain={activeChain} />
            </>
          )}
        </main>
      </div>
    </Layout>

  );
}
