"use client";

import { useEffect, useState } from "react";
import { getUserSponsoredGas } from "@/components/dashboard/actions/user";

interface SponsoredGasCardProps {
  address: string;
}

interface GasData {
  totalUSD: number;
  txCount: number;
}

export function SponsoredGasCard({ address }: SponsoredGasCardProps) {
  const [data, setData] = useState<GasData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserSponsoredGas(address)
      .then((res) => {
        if (res) setData({ totalUSD: res.totalUSD, txCount: res.txCount });
      })
      .finally(() => setLoading(false));
  }, [address]);

  return (
    <div className="rounded-xl border border-violet-800/40 bg-violet-950/30 p-6 flex flex-col gap-2">
      <p className="text-xs font-medium text-violet-400 uppercase tracking-wider">
        Total Gas Sponsored
      </p>
      {loading ? (
        <div className="h-9 w-28 rounded-md bg-violet-900/40 animate-pulse" />
      ) : (
        <p className="text-3xl font-bold text-zinc-50">
          $
          {(data?.totalUSD ?? 0).toLocaleString("en-US", {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
          })}
        </p>
      )}
      <p className="text-xs text-zinc-500">
        {loading ? "—" : `Saved across ${data?.txCount ?? 0} transactions · paid by Tango Wallet`}
      </p>
    </div>
  );
}
