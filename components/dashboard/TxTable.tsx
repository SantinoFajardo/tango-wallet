"use client";

import { useEffect, useMemo, useState } from "react";
import type { Chain } from "thirdweb";
import { format, isToday, isYesterday } from "date-fns";
import { getUserTransactions } from "./actions/transactions";

type DbTx = Awaited<ReturnType<typeof getUserTransactions>>[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function rawToDecimal(raw: string, decimals = 18): string {
  try {
    const val = BigInt(raw || "0");
    if (val === 0n) return "0";
    return (Number(val) / 10 ** decimals).toLocaleString("en-US", {
      maximumFractionDigits: 6,
    });
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

function groupByDate(txs: DbTx[]): [string, DbTx[]][] {
  const groups = new Map<string, DbTx[]>();
  for (const tx of txs) {
    const key = tx.created_at
      ? format(new Date(tx.created_at), "yyyy-MM-dd")
      : "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }
  return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TxTypeIcon({ direction }: { direction: "in" | "out" | string }) {
  const config =
    direction === "in"
      ? { icon: "⬇", bg: "var(--ok-wash)", fg: "var(--ok-ink)" }
      : { icon: "⬆", bg: "var(--err-wash)", fg: "var(--err-ink)" };
  return (
    <div
      className="flex items-center justify-center text-sm font-bold shrink-0"
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: config.bg,
        color: config.fg,
      }}
    >
      {config.icon}
    </div>
  );
}

function ChainBadge({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "#62728822", color: "var(--ink-faint)", fontSize: 11 }}
    >
      {name}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "SUCCESS") return <span className="text-ok-ink">Success</span>;
  if (status === "PENDING")
    return <span className="text-ink-faint">Pending</span>;
  return <span className="text-err-ink">Failed</span>;
}

function SponsoredPill() {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-semibold"
      style={{
        background: "var(--ok-wash)",
        color: "var(--ok-ink)",
        fontSize: 10,
        letterSpacing: "0.03em",
      }}
    >
      ⛽ Gas-free
    </span>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-line">
      <div className="w-9 h-9 rounded-xl bg-layer animate-pulse shrink-0" />
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
  const [txs, setTxs] = useState<DbTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);
    setTxs([]);

    getUserTransactions(address, chain.id)
      .then(setTxs)
      .catch((e: unknown) =>
        setErrorMsg(
          e instanceof Error ? e.message : "Failed to load transactions"
        )
      )
      .finally(() => setLoading(false));
  }, [address, chain.id]);

  const grouped = useMemo(() => groupByDate(txs), [txs]);

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-layer">
        <span className="text-sm font-bold text-ink">Transaction History</span>
        <span className="text-xs font-semibold text-brand cursor-pointer">
          View all →
        </span>
      </div>

      {loading ? (
        Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
      ) : errorMsg ? (
        <p className="px-5 py-8 text-center text-xs text-err-ink">{errorMsg}</p>
      ) : txs.length === 0 ? (
        <p className="px-5 py-8 text-center text-ink-faint">
          No transactions found on this chain
        </p>
      ) : (
        grouped.map(([dateKey, dateTxs]) => (
          <div key={dateKey}>
            <div className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-ink-faint bg-layer border-b border-line">
              {formatDateLabel(dateKey)}
            </div>

            {dateTxs.map((tx, i) => {
              const isOut = tx.direction === "out";
              const txUrl = getExplorerTxUrl(chain, tx.tx_hash);
              const amount = rawToDecimal(tx.value_raw, tx.decimals ?? 18);
              const isSponsored = !!tx.sponsored_gas_wei;
              const isLast = i === dateTxs.length - 1;

              return (
                <div
                  key={`${tx.tx_hash}-${tx.direction}`}
                  className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-stripe ${
                    !isLast ? "border-b border-line" : ""
                  }`}
                >
                  <TxTypeIcon direction={tx.direction} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-ink capitalize">
                        {isOut ? "Send" : "Receive"}
                      </span>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          background: "#0052FF22",
                          color: "#0052FF",
                          fontSize: 11,
                        }}
                      >
                        {tx.symbol || "Unknown"}
                      </span>
                      <ChainBadge name={chain.name ?? `Chain ${chain.id}`} />
                      {isSponsored && <SponsoredPill />}
                    </div>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {tx.from_address && (
                        <p className="text-xs text-ink-faint truncate">
                          <span className="opacity-60">From</span>{" "}
                          <span className="font-mono">{shortAddr(tx.from_address)}</span>
                        </p>
                      )}
                      {tx.to_address && (
                        <p className="text-xs text-ink-faint truncate">
                          <span className="opacity-60">To</span>{" "}
                          <span className="font-mono">{shortAddr(tx.to_address)}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {txUrl ? (
                      <a
                        href={txUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold font-mono text-link hover:text-link-hi transition-colors"
                      >
                        {isOut ? "-" : "+"}
                        {amount} {tx.symbol}
                      </a>
                    ) : (
                      <span
                        className={`text-sm font-semibold font-mono ${
                          isOut ? "text-err-ink" : "text-ok-ink"
                        }`}
                      >
                        {isOut ? "-" : "+"}
                        {amount} {tx.symbol}
                      </span>
                    )}
                    <p className="text-xs text-ink-faint mt-0.5">
                      <StatusBadge status={tx.status} />
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
