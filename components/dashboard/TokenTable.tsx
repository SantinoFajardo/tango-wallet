"use client";

import { useCallback, useEffect, useState } from "react";
import { getNativeTokenPriceUSD } from "@/lib/prices";
import { getAllTokenUserBalances, refreshAllBalances } from "@/components/dashboard/actions/balances";

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
  onTotalChange: (usd: number) => void;
}

function formatAmount(amount: number): string {
  if (amount === 0) return "0";
  return amount.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function rawToAmount(rawBalance: string, decimals: number): number {
  const raw = BigInt(rawBalance);
  const divisor = 10n ** BigInt(decimals);
  const whole = Number(raw / divisor);
  const frac = Number(raw % divisor) / Math.pow(10, decimals);
  return whole + frac;
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

export function TokenTable({ address, onTotalChange }: TokenTableProps) {
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const buildRows = useCallback(async (
    balances: Awaited<ReturnType<typeof getAllTokenUserBalances>>,
  ): Promise<TokenRow[]> => {
    if (!balances || balances.length === 0) return [];

    // Aggregate by symbol across all chains.
    const aggregated = new Map<string, {
      symbol: string;
      name: string;
      totalAmount: number;
      isNative: boolean;
    }>();

    for (const b of balances) {
      const amount = rawToAmount(b.raw_balance, b.decimals);
      const key = b.symbol.toUpperCase();
      const isNative = b.contract_address === null;

      const existing = aggregated.get(key);
      if (existing) {
        existing.totalAmount += amount;
      } else {
        aggregated.set(key, { symbol: b.symbol, name: b.token_name, totalAmount: amount, isNative });
      }
    }

    // Fetch USD prices for native tokens (parallel).
    const priceEntries = await Promise.all(
      [...aggregated.entries()]
        .filter(([, v]) => v.isNative)
        .map(async ([key, v]) => {
          const price = await getNativeTokenPriceUSD(v.symbol).catch(() => 0);
          return [key, price] as const;
        }),
    );
    const prices = new Map(priceEntries);

    const built: TokenRow[] = [...aggregated.entries()].map(([key, v]) => {
      const priceUSD = prices.get(key) ?? 0;
      return {
        key,
        symbol: v.symbol,
        name: v.name,
        displayValue: formatAmount(v.totalAmount),
        priceUSD,
        valueUSD: v.totalAmount * priceUSD,
      };
    });

    // Native tokens first, then ERC20s alphabetically.
    built.sort((a, b) => {
      const aNative = aggregated.get(a.key)?.isNative ?? false;
      const bNative = aggregated.get(b.key)?.isNative ?? false;
      if (aNative && !bNative) return -1;
      if (!aNative && bNative) return 1;
      return a.symbol.localeCompare(b.symbol);
    });

    return built;
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      let balances = await getAllTokenUserBalances(address);
      const hasData = balances && balances.length > 0;

      // On refresh or empty DB: pull fresh data from all chains.
      if (isRefresh || !hasData) {
        balances = await refreshAllBalances(address);
      }

      const built = await buildRows(balances);
      setRows(built);
      onTotalChange(built.reduce((s, r) => s + r.valueUSD, 0));
    } catch (err) {
      console.error("[TokenTable] Failed to load balances:", err);
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [address, buildRows, onTotalChange]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Tokens</h2>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-ink-dim hover:text-ink transition-colors disabled:opacity-50"
        >
          <svg
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5a5.5 5.5 0 0 1 3.89 1.61L13.5 5.5" />
            <path d="M13.5 2.5v3h-3" />
          </svg>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
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
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} />)
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-ink-faint text-xs">
                  No balances found. Send or receive tokens to get started.
                </td>
              </tr>
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
