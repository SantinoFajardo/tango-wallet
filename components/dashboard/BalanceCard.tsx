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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-2">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        Total Balance
      </p>
      {isLoading ? (
        <div className="h-9 w-36 rounded-md bg-zinc-800 animate-pulse" />
      ) : (
        <p className="text-3xl font-bold text-zinc-50">
          ${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      )}
      {/*  todo: balances on all chains */}
      <p className="text-xs text-zinc-500">Across all tokens · Base Sepolia</p>
      <div className="flex gap-2 w-full">
        <Button onClick={() => {
          router.push("/send");
        }} className="w-1/2">Withdraw</Button>
        <Button variant="secondary" className="w-1/2">Deposit</Button>
      </div>
    </div>
  );
}
