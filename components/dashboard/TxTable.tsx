"use client";

import { useEffect, useState } from "react";
import { Insight } from "thirdweb";
import type { Chain } from "thirdweb";
import { client } from "@/lib/client";
import { formatDistanceToNow } from "date-fns";

type InsightTx = Awaited<ReturnType<typeof Insight.getTransactions>>[number];

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function weiToEth(wei: string, decimals = 18): string {
  try {
    const val = BigInt(wei || "0");
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

function getExplorerAddressUrl(chain: Chain, address: string): string | null {
  const url = chain.blockExplorers?.[0]?.url;
  return url ? `${url}/address/${address}` : null;
}

interface TxTableProps {
  address: string;
  chain: Chain;
}

function RowSkeleton() {
  return (
    <tr className="border-b border-zinc-800/50">
      {Array.from({ length: 6 }).map((_, j) => (
        <td key={j} className="px-6 py-4">
          <div className="h-4 rounded bg-zinc-800 animate-pulse w-24" />
        </td>
      ))}
    </tr>
  );
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
        setErrorMsg(
          e instanceof Error ? e.message : "Failed to load transactions",
        ),
      )
      .finally(() => setLoading(false));
  }, [address, chain]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-200">Transaction History</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 text-xs border-b border-zinc-800">
              <th className="px-6 py-3 font-medium">Hash</th>
              <th className="px-6 py-3 font-medium">From</th>
              <th className="px-6 py-3 font-medium">To</th>
              <th className="px-6 py-3 font-medium text-right">
                Value ({nativeSymbol})
              </th>
              <th className="px-6 py-3 font-medium text-right">Age</th>
              <th className="px-6 py-3 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
            ) : errorMsg ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-8 text-center text-red-400 text-xs"
                >
                  {errorMsg}
                </td>
              </tr>
            ) : txs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-8 text-center text-zinc-600"
                >
                  No transactions found on this chain
                </td>
              </tr>
            ) : (
              txs.map((tx) => {
                const isOutbound =
                  tx.from_address?.toLowerCase() === address.toLowerCase();
                const timestamp = tx.block_timestamp
                  ? formatDistanceToNow(
                      new Date(tx.block_timestamp * 1000),
                      { addSuffix: true },
                    )
                  : "—";
                const txUrl = getExplorerTxUrl(chain, tx.hash);
                const fromUrl = tx.from_address
                  ? getExplorerAddressUrl(chain, tx.from_address)
                  : null;
                const toUrl = tx.to_address
                  ? getExplorerAddressUrl(chain, tx.to_address)
                  : null;

                return (
                  <tr
                    key={tx.hash}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      {txUrl ? (
                        <a
                          href={txUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-violet-400 hover:text-violet-300 transition-colors"
                        >
                          {shortHash(tx.hash)}
                        </a>
                      ) : (
                        <span className="font-mono text-zinc-400">
                          {shortHash(tx.hash)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-400 text-xs">
                      {tx.from_address ? (
                        fromUrl ? (
                          <a
                            href={fromUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-zinc-200 transition-colors"
                          >
                            {shortAddr(tx.from_address)}
                          </a>
                        ) : (
                          shortAddr(tx.from_address)
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-400 text-xs">
                      {tx.to_address ? (
                        toUrl ? (
                          <a
                            href={toUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-zinc-200 transition-colors"
                          >
                            {shortAddr(tx.to_address)}
                          </a>
                        ) : (
                          shortAddr(tx.to_address)
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      <span className={!isOutbound ? "text-green-400" : "text-zinc-200"}>
                        {!isOutbound ? "+" : ""}
                        {weiToEth(
                          tx.value,
                          chain.nativeCurrency?.decimals ?? 18,
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-zinc-500 text-xs whitespace-nowrap">
                      {timestamp}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {tx.status === 1 ? (
                        <span className="inline-flex items-center rounded-full bg-green-950 px-2 py-0.5 text-xs font-medium text-green-400 ring-1 ring-green-800">
                          Success
                        </span>
                      ) : tx.status === 0 ? (
                        <span className="inline-flex items-center rounded-full bg-red-950 px-2 py-0.5 text-xs font-medium text-red-400 ring-1 ring-red-800">
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-700">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
