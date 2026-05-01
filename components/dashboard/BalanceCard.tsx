"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserSponsoredGas } from "@/components/dashboard/actions/user";

interface BalanceCardProps {
  totalUSD: number;
  isLoading: boolean;
  address: string;
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const glass = {
  background: "rgba(255,255,255,0.12)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.18)",
} as const;

export function BalanceCard({ totalUSD, isLoading, address }: BalanceCardProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [gasData, setGasData] = useState<{ totalUSD: number; txCount: number } | null>(null);
  const [gasLoading, setGasLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    getUserSponsoredGas(address)
      .then((res) => {
        if (res) setGasData({ totalUSD: res.totalUSD, txCount: res.txCount });
      })
      .finally(() => setGasLoading(false));
  }, [address]);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
        borderRadius: 20,
        padding: "32px 36px",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(109, 40, 217, 0.35)",
      }}
    >
      {/* Decorative circles */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -60, right: 80, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Label */}
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.65)" }}>
          Total Portfolio Value
        </p>

        {/* Balance row */}
        <div className="flex items-end gap-3 mb-6">
          {isLoading ? (
            <div className="h-14 w-48 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.15)" }} />
          ) : (
            <p className="text-5xl font-bold text-white leading-none" style={{ letterSpacing: "-0.02em" }}>
              {visible ? `$${fmt(totalUSD)}` : "••••••"}
            </p>
          )}
          <span className="mb-2 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>USD</span>
          <button
            onClick={() => setVisible(!visible)}
            className="mb-2 text-sm"
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}
          >
            {visible ? "👁" : "🙈"}
          </button>
        </div>

        {/* Gas sponsored stat */}
        <div className="inline-flex items-center gap-3" style={{ ...glass, borderRadius: 14, padding: "14px 20px" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center text-lg flex-shrink-0"
              style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.15)" }}
            >
              ⛽
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)" }}>
                Gas Sponsored by Tango
              </p>
              {gasLoading ? (
                <div className="h-6 w-20 rounded mt-1 animate-pulse" style={{ background: "rgba(255,255,255,0.15)" }} />
              ) : (
                <p className="text-2xl font-bold text-white">
                  ${fmt(gasData?.totalUSD ?? 0, 4)}
                </p>
              )}
            </div>
          </div>
          <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.7)", maxWidth: 140 }}>
            You never paid a gas fee. Ever.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-6">
          {[
            { label: "⬆ Send", onClick: () => router.push("/send") },
            { label: "⬇ Receive", onClick: () => {} },
          ].map(({ label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="text-sm font-semibold text-white transition-all"
              style={{ ...glass, padding: "10px 22px", borderRadius: 10, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
