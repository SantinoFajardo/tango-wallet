"use client";

import { useEffect, useMemo, useState } from "react";
import { Insight } from "thirdweb";
import type { Chain } from "thirdweb";
import { client } from "@/lib/client";
import { format, isToday, isYesterday } from "date-fns";

type InsightTx = Awaited<ReturnType<typeof Insight.getTransactions>>[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function weiToEth(wei: string, decimals = 18): string {
  try {
    const val = BigInt(wei || "0");
    if (val === 0n) return "0";
    return (Number(val) / 10 ** decimals).toLocaleString("en-US", { maximumFractionDigits: 6 });
  } catch {
    return "0";
  }
}

function getExplorerTxUrl(chain: Chain, hash: string): string | null {
  const url = chain.blockExplorers?.[0]?.url;
  return url ? `${url}/tx/${hash}` : null;
}

function formatDateLabel(dateKey: string): string {
  if (dateKey === "unknown") return "Unknown date";
  const d = new Date(dateKey + "T12:00:00");
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d, yyyy");
}

function groupByDate(txs: InsightTx[]): [string, InsightTx[]][] {
  const groups = new Map<string, InsightTx[]>();
  for (const tx of txs) {
    const key = tx.block_timestamp
      ? format(new Date(tx.block_timestamp * 1000), "yyyy-MM-dd")
      : "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }
  return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChainBadge({ chain }: { chain: Chain }) {
  const color = chain.id === 84532 ? "#0052FF" : "#627EEA";
  const name = chain.name ?? `Chain ${chain.id}`;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + "22", color, fontSize: 11, letterSpacing: "0.02em" }}
    >
      {name}
    </span>
  );
}

function GasPill() {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-semibold"
      style={{ background: "var(--ok-wash)", color: "var(--ok-ink)", fontSize: 10, letterSpacing: "0.03em" }}
    >
      ⛽ Gas-free
    </span>
  );
}

function TxTypeIcon({ type }: { type: "send" | "receive" | "other" }) {
  const config = {
    receive: { icon: "⬇", bg: "var(--ok-wash)",  fg: "var(--ok-ink)"  },
    send:    { icon: "⬆", bg: "var(--err-wash)", fg: "var(--err-ink)" },
    other:   { icon: "⇄", bg: "var(--tint)",     fg: "var(--tint-ink)" },
  }[type];
  return (
    <div
      className="flex items-center justify-center text-sm font-bold flex-shrink-0"
      style={{ width: 36, height: 36, borderRadius: 10, background: config.bg, color: config.fg }}
    >
      {config.icon}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-line">
      <div className="w-9 h-9 rounded-xl bg-layer animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-32 rounded bg-layer animate-pulse" />
        <div className="h-3 w-24 rounded bg-layer animate-pulse" />
      </div>
      <div className="space-y-1.5 text-right">
        <div className="h-3.5 w-20 rounded bg-layer animate-pulse" />
        <div className="h-3 w-14 rounded bg-layer animate-pulse" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface TxTableProps {
  address: string;
  chain: Chain;
}

export function TxTable({ address, chain }: TxTableProps) {
  const [txs, setTxs] = useState<InsightTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const nativeSymbol = chain.nativeCurrency?.symbol ?? "ETH";

  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);
    setTxs([]);

    Insight.getTransactions({
      client,
      walletAddress: address,
      chains: [chain],
      queryOptions: { limit: 20, sort_order: "desc" },
    })
      .then(setTxs)
      .catch((e: unknown) =>
        setErrorMsg(e instanceof Error ? e.message : "Failed to load transactions"),
      )
      .finally(() => setLoading(false));
  }, [address, chain]);

  const grouped = useMemo(() => groupByDate(txs), [txs]);

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-layer">
        <span className="text-sm font-bold text-ink">Transaction History</span>
        <span className="text-xs font-semibold text-brand cursor-pointer">View all →</span>
      </div>

      {loading ? (
        Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
      ) : errorMsg ? (
        <p className="px-5 py-8 text-center text-xs text-err-ink">{errorMsg}</p>
      ) : txs.length === 0 ? (
        <p className="px-5 py-8 text-center text-ink-faint">No transactions found on this chain</p>
      ) : (
        grouped.map(([dateKey, dateTxs]) => (
          <div key={dateKey}>
            {/* Date group label */}
            <div className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-ink-faint bg-layer border-b border-line">
              {formatDateLabel(dateKey)}
            </div>

            {dateTxs.map((tx, i) => {
              const isOutbound = tx.from_address?.toLowerCase() === address.toLowerCase();
              const txType = isOutbound ? "send" : "receive";
              const txUrl = getExplorerTxUrl(chain, tx.hash);
              const counterparty = isOutbound
                ? tx.to_address ? `To ${shortAddr(tx.to_address)}` : "Unknown"
                : tx.from_address ? `From ${shortAddr(tx.from_address)}` : "Unknown";
              const amount = weiToEth(tx.value, chain.nativeCurrency?.decimals ?? 18);
              const isLast = i === dateTxs.length - 1;

              return (
                <div
                  key={tx.hash}
                  className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-stripe ${!isLast ? "border-b border-line" : ""}`}
                >
                  <TxTypeIcon type={txType} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-ink capitalize">{txType}</span>
                      <ChainBadge chain={chain} />
                      <GasPill />
                    </div>
                    <p className="text-xs text-ink-faint mt-0.5 truncate">{counterparty}</p>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    {txUrl ? (
                      <a
                        href={txUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold font-mono text-link hover:text-link-hi transition-colors"
                      >
                        {isOutbound ? "-" : "+"}{amount} {nativeSymbol}
                      </a>
                    ) : (
                      <span className={`text-sm font-semibold font-mono ${isOutbound ? "text-err-ink" : "text-ok-ink"}`}>
                        {isOutbound ? "-" : "+"}{amount} {nativeSymbol}
                      </span>
                    )}
                    <p className="text-xs text-ink-faint mt-0.5">
                      {tx.status === 1 ? (
                        <span className="text-ok-ink">Success</span>
                      ) : tx.status === 0 ? (
                        <span className="text-err-ink">Failed</span>
                      ) : (
                        <span>Pending</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
