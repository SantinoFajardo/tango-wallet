"use client";

import { useCallback, useEffect, useState } from "react";
import { Insight } from "thirdweb";
import type { Chain } from "thirdweb";
import { useWalletBalance } from "thirdweb/react";
import { client } from "@/lib/client";
import { getNativeTokenPriceUSD } from "@/lib/prices";

type OwnedToken = Awaited<ReturnType<typeof Insight.getOwnedTokens>>[number];

interface TokenRow {
  key: string;
  symbol: string;
  name: string;
  displayValue: string;
  priceUSD: number;
  valueUSD: number;
}

interface TokenTableProps {
  address: string;
  chain: Chain;
  onTotalChange: (usd: number) => void;
}

function Skeleton() {
  return (
    <tr className="border-b border-line">
      {Array.from({ length: 4 }).map((_, j) => (
        <td key={j} className="px-6 py-4">
          <div className="h-4 rounded bg-layer animate-pulse w-20" />
        </td>
      ))}
    </tr>
  );
}

export function TokenTable({ address, chain, onTotalChange }: TokenTableProps) {
  const [nativePriceUSD, setNativePriceUSD] = useState(0);
  const [erc20s, setErc20s] = useState<OwnedToken[]>([]);
  const [loading, setLoading] = useState(true);

  const nativeSymbol = chain.nativeCurrency?.symbol ?? "ETH";

  const { data: nativeBalance, isLoading: nativeLoading } = useWalletBalance({
    client,
    chain,
    address,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [price, owned] = await Promise.all([
        getNativeTokenPriceUSD(nativeSymbol),
        Insight.getOwnedTokens({
          client,
          ownerAddress: address,
          chains: [chain],
          queryOptions: { include_native: "false" },
        }),
      ]);
      setNativePriceUSD(price);
      setErc20s(owned);
    } catch {
      setErc20s([]);
    } finally {
      setLoading(false);
    }
  }, [address, chain, nativeSymbol]);

  useEffect(() => {
    load();
  }, [load]);

  const nativeAmount = parseFloat(nativeBalance?.displayValue ?? "0");
  const nativeValueUSD = nativeAmount * nativePriceUSD;

  const rows: TokenRow[] = [
    {
      key: `native-${chain.id}`,
      symbol: nativeSymbol,
      name: chain.name ?? nativeSymbol,
      displayValue: nativeAmount.toLocaleString("en-US", { maximumFractionDigits: 6 }),
      priceUSD: nativePriceUSD,
      valueUSD: nativeValueUSD,
    },
    ...erc20s.map((t) => ({
      key: `erc20-${t.tokenAddress}`,
      symbol: t.symbol,
      name: t.name,
      displayValue: t.displayValue,
      priceUSD: 0,
      valueUSD: 0,
    })),
  ];

  const total = rows.reduce((s, r) => s + r.valueUSD, 0);

  useEffect(() => {
    if (!nativeLoading && !loading) onTotalChange(total);
  }, [total, nativeLoading, loading, onTotalChange]);

  const isSpinning = nativeLoading || loading;

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="px-6 py-4 border-b border-line">
        <h2 className="text-sm font-semibold text-ink">Tokens</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-faint text-xs border-b border-line">
              <th className="px-6 py-3 font-medium">Token</th>
              <th className="px-6 py-3 font-medium text-right">Balance</th>
              <th className="px-6 py-3 font-medium text-right">Price</th>
              <th className="px-6 py-3 font-medium text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {isSpinning ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} />)
            ) : (
              rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-line hover:bg-stripe transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-layer flex items-center justify-center text-xs font-bold text-ink-dim">
                        {row.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-ink">{row.symbol}</p>
                        <p className="text-xs text-ink-faint">{row.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-ink-dim">
                    {row.displayValue}
                  </td>
                  <td className="px-6 py-4 text-right text-ink-dim">
                    {row.priceUSD > 0
                      ? `$${row.priceUSD.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-ink">
                    {row.valueUSD > 0
                      ? `$${row.valueUSD.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
