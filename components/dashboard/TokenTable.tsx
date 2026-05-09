"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { getNativeTokenPriceUSD } from "@/lib/prices";
import {
  getAllTokenUserBalances,
  refreshAllBalances,
} from "@/components/dashboard/actions/balances";

interface ChainBreakdown {
  chainId: number;
  chainName: string;
  chainImageUrl: string;
  amount: number;
}

interface TokenRow {
  key: string;
  symbol: string;
  name: string;
  imageUrl: string;
  displayValue: string;
  priceUSD: number;
  valueUSD: number;
  chains: ChainBreakdown[];
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

type BalanceWithMeta = {
  id: string;
  user_address: string;
  chain_id: number;
  contract_address: string | null;
  symbol: string;
  token_name: string;
  decimals: number;
  raw_balance: string;
  updated_at: string;
  image_url?: string;
  is_stable?: boolean;
  chain_name?: string;
  chain_image_url?: string;
};

export function TokenTable({ address, onTotalChange }: TokenTableProps) {
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const buildRows = useCallback(
    async (
      balances: BalanceWithMeta[] | null
    ): Promise<TokenRow[]> => {
      if (!balances || balances.length === 0) return [];

      const aggregated = new Map<
        string,
        {
          symbol: string;
          name: string;
          imageUrl: string;
          totalAmount: number;
          isNative: boolean;
          isStable: boolean;
          chainMap: Map<number, ChainBreakdown>;
        }
      >();

      for (const b of balances) {
        const amount = rawToAmount(b.raw_balance, b.decimals);
        const key = b.symbol.toUpperCase();
        const isNative = b.contract_address === null;

        const existing = aggregated.get(key);
        if (existing) {
          existing.totalAmount += amount;
          const chainEntry = existing.chainMap.get(b.chain_id);
          if (chainEntry) {
            chainEntry.amount += amount;
          } else {
            existing.chainMap.set(b.chain_id, {
              chainId: b.chain_id,
              chainName: b.chain_name ?? `Chain ${b.chain_id}`,
              chainImageUrl: b.chain_image_url ?? "",
              amount,
            });
          }
        } else {
          const chainMap = new Map<number, ChainBreakdown>();
          chainMap.set(b.chain_id, {
            chainId: b.chain_id,
            chainName: b.chain_name ?? `Chain ${b.chain_id}`,
            chainImageUrl: b.chain_image_url ?? "",
            amount,
          });
          aggregated.set(key, {
            symbol: b.symbol,
            name: b.token_name,
            imageUrl: b.image_url ?? "",
            totalAmount: amount,
            isNative,
            isStable: b.is_stable ?? false,
            chainMap,
          });
        }
      }

      // Drop tokens with no balance before further processing.
      for (const [key, v] of aggregated) {
        if (v.totalAmount <= 0) aggregated.delete(key);
      }

      // Fetch USD prices for non-stable native tokens (parallel).
      const priceEntries = await Promise.all(
        [...aggregated.entries()]
          .filter(([, v]) => v.isNative && !v.isStable)
          .map(async ([key, v]) => {
            const price = await getNativeTokenPriceUSD(v.symbol).catch(() => 0);
            return [key, price] as const;
          })
      );
      const prices = new Map(priceEntries);

      const built: TokenRow[] = [...aggregated.entries()].map(([key, v]) => {
        const priceUSD = v.isStable ? 1.0 : (prices.get(key) ?? 0);
        return {
          key,
          symbol: v.symbol,
          name: v.name,
          imageUrl: v.imageUrl,
          displayValue: formatAmount(v.totalAmount),
          priceUSD,
          valueUSD: v.totalAmount * priceUSD,
          chains: [...v.chainMap.values()].filter((c) => c.amount > 0),
        };
      });

      built.sort((a, b) => {
        const aNative = aggregated.get(a.key)?.isNative ?? false;
        const bNative = aggregated.get(b.key)?.isNative ?? false;
        if (aNative && !bNative) return -1;
        if (!aNative && bNative) return 1;
        return a.symbol.localeCompare(b.symbol);
      });

      return built;
    },
    []
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        let balances = await getAllTokenUserBalances(address);
        const hasData = balances && balances.length > 0;

        if (isRefresh || !hasData) {
          balances = (await refreshAllBalances(address)) as typeof balances;
        }

        const built = await buildRows(balances as BalanceWithMeta[]);
        setRows(built);
        onTotalChange(built.reduce((s, r) => s + r.valueUSD, 0));
      } catch (err) {
        console.error("[TokenTable] Failed to load balances:", err);
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [address, buildRows, onTotalChange]
  );

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
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-ink-faint text-xs"
                >
                  No balances found. Send or receive tokens to get started.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <Fragment key={row.key}>
                  <tr
                    className="border-b border-line hover:bg-stripe transition-colors cursor-pointer"
                    onClick={() => toggleExpand(row.key)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {row.imageUrl ? (
                          <img
                            src={row.imageUrl}
                            alt={row.symbol}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-layer flex items-center justify-center text-xs font-bold text-ink-dim">
                            {row.symbol.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-ink">{row.symbol}</p>
                          <p className="text-xs text-ink-faint">{row.name}</p>
                        </div>
                        <span className="ml-1 text-ink-faint">
                          <ChevronIcon open={expanded.has(row.key)} />
                        </span>
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

                  <tr className="border-b border-line">
                    <td colSpan={4} className="p-0">
                      <div
                        style={{
                          maxHeight: expanded.has(row.key)
                            ? `${row.chains.length * 44}px`
                            : "0px",
                          opacity: expanded.has(row.key) ? 1 : 0,
                          overflow: "hidden",
                          transition: "max-height 0.25s ease, opacity 0.2s ease",
                        }}
                      >
                        {row.chains.map((c) => (
                          <div
                            key={`${row.key}:${c.chainId}`}
                            className="flex items-center bg-stripe px-6 py-2.5"
                          >
                            <div className="flex items-center gap-2 flex-1 pl-10">
                              {c.chainImageUrl ? (
                                <img
                                  src={c.chainImageUrl}
                                  alt={c.chainName}
                                  className="w-4 h-4 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-layer" />
                              )}
                              <span className="text-xs text-ink-dim">{c.chainName}</span>
                            </div>
                            <span className="font-mono text-xs text-ink-dim w-1/4 text-right">
                              {formatAmount(c.amount)}
                            </span>
                            <span className="w-1/4" />
                            <span className="w-1/4" />
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
