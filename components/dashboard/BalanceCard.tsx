"use client";

import { useRouter } from "next/navigation";
import { Button } from "../ui/Button";

interface BalanceCardProps {
  totalUSD: number;
  isLoading: boolean;
}

export function BalanceCard({ totalUSD, isLoading }: BalanceCardProps) {
  const router = useRouter();
  return (
    <div className="rounded-xl border border-line bg-surface p-6 flex flex-col gap-2">
      <p className="text-xs font-medium text-ink-faint uppercase tracking-wider">
        Total Balance
      </p>
      {isLoading ? (
        <div className="h-9 w-36 rounded-md bg-layer animate-pulse" />
      ) : (
        <p className="text-3xl font-bold text-ink">
          ${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      )}
      {/*  todo: balances on all chains */}
      <p className="text-xs text-ink-faint">Across all tokens · Base Sepolia</p>
      <div className="flex gap-2 w-full">
        <Button onClick={() => {
          router.push("/send");
        }} className="w-1/2">Withdraw</Button>
        <Button variant="secondary" className="w-1/2">Deposit</Button>
      </div>
    </div>
  );
}
