"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  useActiveAccount,
  useSendAndConfirmTransaction,
  useSwitchActiveWalletChain,
  useWalletBalance,
} from "thirdweb/react";
import { defineChain, getContract, prepareContractCall, prepareTransaction } from "thirdweb";
import { isAddress, toWei } from "thirdweb/utils";
import { client } from "@/lib/client";
import { getChains, getTokensWithBalances } from "@/components/dashboard/actions/assets";
import type { ChainRow, TokenWithBalance } from "@/components/dashboard/actions/assets";
import { recordSponsoredTransaction } from "@/components/dashboard/actions/transactions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = amount.split(".");
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

const STEPS = ["Chain", "Token", "Amount", "Recipient", "Review"] as const;

// ── StepBar ───────────────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-9">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Fragment key={step}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  "w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all",
                  done
                    ? "bg-ok-ink text-white"
                    : active
                      ? "bg-brand text-white ring-4 ring-tint"
                      : "bg-layer text-ink-faint border-2 border-line",
                ].join(" ")}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={[
                  "text-[11px] font-semibold whitespace-nowrap",
                  active ? "text-brand" : done ? "text-ok-ink" : "text-ink-faint",
                ].join(" ")}
              >
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  "flex-1 h-0.5 mb-[18px] mx-1 transition-colors",
                  done ? "bg-ok-ink" : "bg-line",
                ].join(" ")}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── ChainStep ─────────────────────────────────────────────────────────────────

function ChainStep({
  chains,
  tokenCounts,
  selected,
  onSelect,
}: {
  chains: ChainRow[];
  tokenCounts: Map<number, number>;
  selected: ChainRow | null;
  onSelect: (chain: ChainRow) => void;
}) {
  return (
    <div>
      <h2 className="text-[22px] font-bold text-ink mb-1.5">Select network</h2>
      <p className="text-sm text-ink-faint mb-7">Choose which blockchain to send from.</p>
      <div className="flex flex-col gap-3">
        {chains.map((chain) => {
          const active = selected?.id === chain.id;
          const count = tokenCounts.get(chain.chain_id) ?? 0;
          console.log(chain)
          console.log(tokenCounts)
          return (
            <button
              key={chain.id}
              onClick={() => onSelect(chain)}
              className={[
                "flex items-center gap-4 px-5 py-[18px] rounded-2xl border-2 text-left transition-all cursor-pointer",
                active
                  ? "border-brand bg-tint shadow-[0_0_0_4px_color-mix(in_srgb,var(--tint)_50%,transparent)]"
                  : "border-line bg-surface hover:border-line-hi",
              ].join(" ")}
            >
              <div
                className={[
                  "w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0",
                  active ? "bg-brand text-white" : "bg-layer text-brand",
                ].join(" ")}
              >
                {chain.name.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-ink">{chain.name}</div>
                <div className="text-[13px] text-ink-faint mt-0.5">
                  {count > 0
                    ? `${count} asset${count !== 1 ? "s" : ""} with balance`
                    : "No balances found"}
                </div>
              </div>
              <div
                className={[
                  "w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                  active ? "border-brand bg-brand text-white" : "border-line",
                ].join(" ")}
              >
                {active && "✓"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── TokenStep ─────────────────────────────────────────────────────────────────

function TokenStep({
  tokens,
  chain,
  selected,
  onSelect,
}: {
  tokens: TokenWithBalance[];
  chain: ChainRow | null;
  selected: TokenWithBalance | null;
  onSelect: (token: TokenWithBalance) => void;
}) {
  if (tokens.length === 0) {
    return (
      <div>
        <h2 className="text-[22px] font-bold text-ink mb-1.5">Select asset</h2>
        <p className="text-sm text-ink-faint">No assets with a balance on {chain?.name ?? "this chain"}.</p>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-[22px] font-bold text-ink mb-1.5">Select asset</h2>
      <p className="text-sm text-ink-faint mb-7">
        Sending from{" "}
        <span className="text-brand font-semibold">{chain?.name}</span>. Pick a token.
      </p>
      <div className="flex flex-col gap-2.5">
        {tokens.map((token) => {
          const active = selected?.id === token.id;
          return (
            <button
              key={token.id}
              onClick={() => onSelect(token)}
              className={[
                "flex items-center gap-3.5 px-5 py-4 rounded-2xl border-2 text-left transition-all cursor-pointer",
                active
                  ? "border-brand bg-tint"
                  : "border-line bg-surface hover:border-line-hi",
              ].join(" ")}
            >
              <div
                className={[
                  "w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0",
                  active ? "bg-brand text-white" : "bg-layer text-brand",
                ].join(" ")}
              >
                {token.symbol.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold text-ink">{token.symbol}</div>
                <div className="text-[13px] text-ink-faint mt-0.5">{token.name}</div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-semibold text-ink font-mono">
                  {fmt(token.display_balance, token.display_balance < 10 ? 4 : 2)} {token.symbol}
                </div>
                {token.usd_value > 0 && (
                  <div className="text-xs text-ink-faint mt-0.5">${fmt(token.usd_value)}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── AmountStep ────────────────────────────────────────────────────────────────

function AmountStep({
  token,
  amount,
  setAmount,
  liveBalanceDisplay,
}: {
  token: TokenWithBalance;
  amount: string;
  setAmount: (v: string) => void;
  liveBalanceDisplay: string | undefined;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"token" | "usd">("token");
  const [display, setDisplay] = useState(amount);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const numDisplay = parseFloat(display) || 0;
  const tokenAmt = mode === "token" ? numDisplay : token.price_usd > 0 ? numDisplay / token.price_usd : 0;
  const maxBalance = liveBalanceDisplay ? parseFloat(liveBalanceDisplay) : token.display_balance;
  const isOver = tokenAmt > maxBalance && tokenAmt > 0;
  const pct = maxBalance > 0 ? Math.min(tokenAmt / maxBalance, 1) * 100 : 0;

  // Sync to parent always in token units
  useEffect(() => {
    setAmount(tokenAmt > 0 ? String(+(tokenAmt.toFixed(8))) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display, mode]);

  function handleModeSwitch() {
    const n = parseFloat(display) || 0;
    if (mode === "token") {
      const usd = n * token.price_usd;
      setDisplay(usd > 0 ? String(+(usd.toFixed(2))) : "");
      setMode("usd");
    } else {
      const tok = token.price_usd > 0 ? n / token.price_usd : 0;
      setDisplay(tok > 0 ? String(+(tok.toFixed(6))) : "");
      setMode("token");
    }
  }

  const PRESETS: [number, string][] = [
    [0.25, "25%"],
    [0.5, "50%"],
    [0.75, "75%"],
    [1, "Max"],
  ];

  return (
    <div>
      <h2 className="text-[22px] font-bold text-ink mb-1.5">Enter amount</h2>
      <p className="text-sm text-ink-faint mb-7">
        Available:{" "}
        <span className="text-ink font-semibold font-mono">
          {liveBalanceDisplay ?? fmt(token.display_balance, token.display_balance < 10 ? 4 : 2)}{" "}
          {token.symbol}
        </span>
      </p>

      {/* Input card */}
      <div
        className={[
          "bg-surface rounded-2xl border-2 px-6 pt-6 pb-5 mb-4 transition-colors",
          isOver ? "border-err-ink" : display ? "border-brand" : "border-line",
        ].join(" ")}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-layer flex items-center justify-center text-lg font-bold text-brand shrink-0">
            {token.symbol.slice(0, 1)}
          </div>
          <input
            ref={inputRef}
            type="number"
            min="0"
            step="any"
            value={display}
            onChange={(e) => setDisplay(e.target.value)}
            placeholder="0.00"
            className={[
              "flex-1 text-4xl font-bold font-mono bg-transparent border-none focus:outline-none w-full",
              isOver ? "text-err-ink" : "text-ink",
            ].join(" ")}
          />
          {token.price_usd > 0 && (
            <button
              onClick={handleModeSwitch}
              className="px-3 py-1.5 rounded-lg bg-layer border border-line text-ink-dim text-[13px] font-semibold cursor-pointer shrink-0 hover:border-line-hi transition-colors"
            >
              {mode === "token" ? token.symbol : "USD"}
            </button>
          )}
        </div>

        {token.price_usd > 0 && (
          <p className="text-sm text-ink-faint pl-[52px]">
            ≈{" "}
            {mode === "token"
              ? `$${fmt(numDisplay * token.price_usd)} USD`
              : `${fmt(numDisplay / token.price_usd, numDisplay / token.price_usd < 10 ? 6 : 4)} ${token.symbol}`}
          </p>
        )}

        {/* Progress bar */}
        <div className="mt-4 h-1 rounded-full bg-layer overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isOver ? "bg-err-ink" : "bg-brand"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {isOver && (
        <div className="px-4 py-2.5 rounded-xl bg-err-wash border border-err-rim text-err-ink text-[13px] font-medium mb-4">
          Amount exceeds your balance of{" "}
          {fmt(token.display_balance, token.display_balance < 10 ? 4 : 2)} {token.symbol}
        </div>
      )}

      <div className="flex gap-2">
        {PRESETS.map(([p, label]) => (
          <button
            key={label}
            onClick={() => {
              const max = liveBalanceDisplay ? parseFloat(liveBalanceDisplay) : maxBalance;
              const val = max * p;
              setDisplay(
                mode === "token"
                  ? String(+(val.toFixed(6)))
                  : String(+(val * token.price_usd).toFixed(2)),
              );
            }}
            className="flex-1 py-2.5 rounded-xl bg-surface border border-line text-ink-dim text-[13px] font-semibold cursor-pointer hover:border-brand hover:text-brand transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── RecipientStep ─────────────────────────────────────────────────────────────

function RecipientStep({
  recipient,
  setRecipient,
  recentAddresses,
}: {
  recipient: string;
  setRecipient: (v: string) => void;
  recentAddresses: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInput = recipient.length > 0;
  const valid = hasInput && isAddress(recipient);
  const invalid = hasInput && !valid;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div>
      <h2 className="text-[22px] font-bold text-ink mb-1.5">Recipient address</h2>
      <p className="text-sm text-ink-faint mb-7">Enter a wallet address to send to.</p>

      <div
        className={[
          "bg-surface rounded-2xl border-2 flex items-center gap-2.5 pl-4 pr-1.5 mb-5 transition-colors",
          hasInput ? (valid ? "border-ok-ink" : "border-err-ink") : "border-line",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value.trim())}
          placeholder="0x…"
          className="flex-1 text-sm font-mono text-ink bg-transparent border-none focus:outline-none py-3.5"
        />
        {hasInput && (
          <button
            onClick={() => setRecipient("")}
            className="w-7 h-7 rounded-full bg-layer border-none text-ink-faint text-xs cursor-pointer flex items-center justify-center shrink-0 hover:text-ink"
          >
            ✕
          </button>
        )}
        <div
          className={[
            "w-9 h-9 rounded-xl flex items-center justify-center text-sm mr-1 shrink-0 transition-all",
            hasInput
              ? valid
                ? "bg-ok-wash text-ok-ink"
                : "bg-err-wash text-err-ink"
              : "bg-layer text-ink-faint",
          ].join(" ")}
        >
          {hasInput ? (valid ? "✓" : "✕") : "◎"}
        </div>
      </div>

      {invalid && (
        <div className="px-4 py-2.5 rounded-xl bg-err-wash border border-err-rim text-err-ink text-[13px] font-medium mb-4">
          Invalid — must be a 42-character hex address starting with 0x.
        </div>
      )}
      {valid && (
        <div className="px-4 py-2.5 rounded-xl bg-ok-wash border border-ok-rim text-ok-ink text-[13px] font-medium mb-4">
          Valid address ✓
        </div>
      )}

      {recentAddresses.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-ink-faint tracking-widest uppercase mb-3">
            Recent
          </p>
          <div className="flex flex-col gap-2">
            {recentAddresses.map((addr, i) => (
              <button
                key={addr}
                onClick={() => setRecipient(addr)}
                className={[
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-left cursor-pointer transition-all",
                  recipient === addr
                    ? "border-2 border-brand bg-tint"
                    : "border border-line bg-surface hover:border-line-hi",
                ].join(" ")}
              >
                <div
                  className="w-9 h-9 rounded-full shrink-0"
                  style={{ background: `hsl(${i * 80 + 200}deg 60% 50%)` }}
                />
                <span className="flex-1 text-[13px] font-mono text-ink truncate">
                  {shortAddr(addr)}
                </span>
                {recipient === addr && <span className="text-brand text-sm">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ReviewStep ────────────────────────────────────────────────────────────────

function ReviewStep({
  chain,
  token,
  amount,
  recipient,
}: {
  chain: ChainRow;
  token: TokenWithBalance;
  amount: string;
  recipient: string;
}) {
  const numAmount = parseFloat(amount) || 0;
  const usdVal = numAmount * token.price_usd;

  return (
    <div>
      <h2 className="text-[22px] font-bold text-ink mb-1.5">Review & confirm</h2>
      <p className="text-sm text-ink-faint mb-7">Double-check the details before sending.</p>

      <div className="bg-surface rounded-2xl border border-line overflow-hidden mb-5">
        {/* Amount hero */}
        <div className="bg-tint px-6 py-6 border-b border-line text-center">
          <p className="text-[11px] font-bold text-ink-faint uppercase tracking-widest mb-1.5">
            You&apos;re sending
          </p>
          <div className="text-[44px] font-bold text-ink leading-none tracking-tight font-mono">
            {fmt(numAmount, numAmount < 10 ? 6 : 4)}
          </div>
          <div className="text-xl font-bold text-brand mt-0.5">{token.symbol}</div>
          {token.price_usd > 0 && (
            <div className="text-[15px] text-ink-faint mt-1.5">≈ ${fmt(usdVal)} USD</div>
          )}
        </div>

        {/* Arrow */}
        <div className="text-center py-3 border-b border-line bg-layer">
          <span className="text-xl text-ink-faint">↓</span>
        </div>

        {/* To */}
        <div className="px-6 py-4 border-b border-line">
          <p className="text-[11px] font-bold text-ink-faint uppercase tracking-widest mb-1.5">
            To
          </p>
          <p className="text-[13px] font-mono text-ink font-medium break-all">{recipient}</p>
        </div>

        {/* Detail rows */}
        <div className="divide-y divide-line">
          <div className="flex items-center justify-between px-6 py-3.5">
            <span className="text-[13px] text-ink-faint">Network</span>
            <span className="text-[13px] font-semibold text-brand">{chain.name}</span>
          </div>
          <div className="flex items-center justify-between px-6 py-3.5">
            <span className="text-[13px] text-ink-faint">Asset</span>
            <span className="text-[13px] font-semibold text-ink">
              {token.symbol} · {token.name}
            </span>
          </div>
          {/* Gas row */}
          <div className="flex items-center justify-between px-6 py-3.5 bg-ok-wash">
            <span className="text-[13px] text-ink-faint">Gas fee</span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-ink-faint line-through">~$0.80</span>
              <span className="px-2.5 py-1 rounded-full bg-ok-ink text-white text-[11px] font-bold tracking-wide">
                ⛽ FREE
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        className="px-4 py-3 rounded-xl text-[13px] leading-relaxed border"
        style={{
          background: "oklch(75% 0.15 60 / 0.08)",
          borderColor: "oklch(75% 0.15 60 / 0.25)",
          color: "oklch(40% 0.12 60)",
        }}
      >
        ⚠️ Transactions are irreversible. Verify the recipient address carefully.
      </div>
    </div>
  );
}

// ── SuccessScreen ─────────────────────────────────────────────────────────────

function SuccessScreen({
  chain,
  token,
  amount,
  recipient,
  txHash,
  onReset,
}: {
  chain: ChainRow;
  token: TokenWithBalance;
  amount: string;
  recipient: string;
  txHash: string;
  onReset: () => void;
}) {
  const numAmount = parseFloat(amount) || 0;
  const usdVal = numAmount * token.price_usd;

  return (
    <div className="text-center py-5">
      <div className="w-20 h-20 rounded-full bg-ok-ink flex items-center justify-center mx-auto mb-6 text-white text-4xl font-bold">
        ✓
      </div>

      <h2 className="text-[26px] font-bold text-ink mb-2">Transaction sent!</h2>
      <p className="text-sm text-ink-faint mb-7 leading-relaxed">
        Your {token.symbol} is on its way — gas covered by Tango.
      </p>

      <div className="inline-flex items-center gap-2.5 bg-surface border border-line rounded-2xl px-5 py-3.5 mb-7">
        <div className="w-10 h-10 rounded-xl bg-layer flex items-center justify-center text-lg font-bold text-brand shrink-0">
          {token.symbol.slice(0, 1)}
        </div>
        <div className="text-left">
          <div className="text-base font-bold text-ink">
            {fmt(numAmount, numAmount < 10 ? 6 : 4)} {token.symbol}
          </div>
          <div className="text-[13px] text-ink-faint">
            {token.price_usd > 0 && `≈ $${fmt(usdVal)} · `}to {shortAddr(recipient)}
          </div>
        </div>
        <div className="ml-2 px-2.5 py-1 rounded-full bg-ok-ink text-white text-[11px] font-bold">
          ⛽ Gas-free
        </div>
      </div>

      <div className="bg-surface border border-line rounded-xl px-5 py-4 mb-7 text-left">
        <p className="text-[11px] font-bold text-ink-faint uppercase tracking-widest mb-1.5">
          Transaction hash
        </p>
        <p className="text-xs font-mono text-ink-dim break-all leading-relaxed">{txHash}</p>
        {chain.explorer_url && (
          <a
            href={`${chain.explorer_url}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-block px-3.5 py-1.5 rounded-lg bg-tint text-tint-ink text-xs font-semibold hover:opacity-80 transition-opacity"
          >
            View on Explorer ↗
          </a>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3.5 rounded-xl bg-surface border border-line text-ink text-[15px] font-semibold cursor-pointer hover:bg-layer transition-colors"
        >
          Send again
        </button>
        <a
          href="/"
          className="flex-1 py-3.5 rounded-xl bg-brand text-white text-[15px] font-semibold flex items-center justify-center hover:bg-brand-hi transition-colors"
        >
          Back to Portfolio
        </a>
      </div>
    </div>
  );
}

// ── Main SendForm ─────────────────────────────────────────────────────────────

export function SendForm() {
  const account = useActiveAccount();
  const { mutate: sendAndConfirm, isPending } = useSendAndConfirmTransaction();
  const switchChain = useSwitchActiveWalletChain();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  const [chains, setChains] = useState<ChainRow[]>([]);
  const [tokensByChain, setTokensByChain] = useState<Map<number, TokenWithBalance[]>>(new Map());
  const [loadingChains, setLoadingChains] = useState(true);

  const [selectedChain, setSelectedChain] = useState<ChainRow | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenWithBalance | null>(null);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);

  const thirdwebChain = selectedChain ? defineChain(selectedChain.chain_id) : undefined;
  const { data: liveBalance } = useWalletBalance({
    client,
    chain: thirdwebChain,
    address: account?.address,
    tokenAddress: selectedToken?.contract_address ?? undefined,
  });

  useEffect(() => {
    if (!account) return;
    getChains()
      .then(async (data) => {
        setChains(data);
        const entries = await Promise.all(
          data.map(async (chain) => {
            const tokens = await getTokensWithBalances(account.address, chain.chain_id);
            return [chain.chain_id, tokens] as [number, TokenWithBalance[]];
          }),
        );
        setTokensByChain(new Map(entries));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load chains"))
      .finally(() => setLoadingChains(false));
  }, [account]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tango_recent_recipients");
      if (stored) setRecentAddresses(JSON.parse(stored) as string[]);
    } catch { }
  }, []);

  function saveRecipient(addr: string) {
    const updated = [addr, ...recentAddresses.filter((a) => a !== addr)].slice(0, 3);
    setRecentAddresses(updated);
    localStorage.setItem("tango_recent_recipients", JSON.stringify(updated));
  }

  const tokensForChain = selectedChain ? (tokensByChain.get(selectedChain.chain_id) ?? []) : [];
  const tokenCounts = new Map<number, number>(
    chains.map((c) => [c.chain_id, tokensByChain.get(c.chain_id)?.length ?? 0]),
  );

  const canProceedFns = [
    () => !!selectedChain,
    () => !!selectedToken,
    () => {
      const n = parseFloat(amount);
      if (!n || n <= 0) return false;
      const max = liveBalance
        ? parseFloat(liveBalance.displayValue)
        : (selectedToken?.display_balance ?? 0);
      return n <= max;
    },
    () => isAddress(recipient),
    () => true,
  ];
  const canProceed = canProceedFns[step] ?? (() => false);

  function handleSelectChain(chain: ChainRow) {
    setSelectedChain(chain);
    setSelectedToken(null);
    setAmount("");
  }

  function handleSelectToken(token: TokenWithBalance) {
    setSelectedToken(token);
    setAmount("");
  }

  async function handleSend() {
    if (!account || !selectedChain || !selectedToken) return;
    setError(null);

    if (!isAddress(recipient)) {
      setError("Enter a valid Ethereum address.");
      return;
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    const chain = defineChain(selectedChain.chain_id);
    await switchChain(chain);

    const tx = selectedToken.is_native
      ? prepareTransaction({ to: recipient, value: toWei(amount), chain, client })
      : prepareContractCall({
        contract: getContract({
          client,
          chain,
          address: selectedToken.contract_address!,
        }),
        method: "function transfer(address to, uint256 amount) returns (bool)",
        params: [recipient as `0x${string}`, parseTokenAmount(amount, selectedToken.decimals)],
      });

    sendAndConfirm(tx, {
      onSuccess: (receipt) => {
        saveRecipient(recipient);
        setTxHash(receipt.transactionHash);
        setDone(true);
        recordSponsoredTransaction(account.address, {
          txHash: receipt.transactionHash,
          chainId: selectedChain.chain_id,
          chainNativeSymbol: selectedToken.is_native ? selectedToken.symbol : "ETH",
          gasUsed: receipt.gasUsed.toString(),
          gasPrice: receipt.effectiveGasPrice.toString(),
          tokenSymbol: selectedToken.symbol,
          contractAddress: selectedToken.is_native ? null : selectedToken.contract_address,
          receiverAddress: recipient,
        }).catch(console.error);
      },
      onError: (e) => setError(e.message?.slice(0, 200) ?? "Transaction failed"),
    });
  }

  function handleReset() {
    setStep(0);
    setDone(false);
    setSelectedChain(null);
    setSelectedToken(null);
    setAmount("");
    setRecipient("");
    setTxHash("");
    setError(null);
  }

  if (!account) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-ink-faint text-sm">
        Connect your wallet to send tokens.
      </div>
    );
  }

  if (loadingChains) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-2 text-ink-faint">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (done && selectedChain && selectedToken) {
    return (
      <div className="bg-surface rounded-[20px] p-8 border border-line shadow-lg">
        <SuccessScreen
          chain={selectedChain}
          token={selectedToken}
          amount={amount}
          recipient={recipient}
          txHash={txHash}
          onReset={handleReset}
        />
      </div>
    );
  }

  return (
    <div>
      <StepBar current={step} />

      <div className="bg-surface rounded-[20px] p-8 border border-line shadow-lg">
        <div className="min-h-[280px]">
          {step === 0 && (
            <ChainStep
              chains={chains}
              tokenCounts={tokenCounts}
              selected={selectedChain}
              onSelect={handleSelectChain}
            />
          )}
          {step === 1 && (
            <TokenStep
              tokens={tokensForChain}
              chain={selectedChain}
              selected={selectedToken}
              onSelect={handleSelectToken}
            />
          )}
          {step === 2 && selectedToken && (
            <AmountStep
              token={selectedToken}
              amount={amount}
              setAmount={setAmount}
              liveBalanceDisplay={liveBalance?.displayValue}
            />
          )}
          {step === 3 && (
            <RecipientStep
              recipient={recipient}
              setRecipient={setRecipient}
              recentAddresses={recentAddresses}
            />
          )}
          {step === 4 && selectedChain && selectedToken && (
            <ReviewStep
              chain={selectedChain}
              token={selectedToken}
              amount={amount}
              recipient={recipient}
            />
          )}
        </div>

        {error && <p className="text-err-ink text-xs mt-4">{error}</p>}

        <div className="flex gap-3 mt-7">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-3.5 rounded-xl bg-layer border border-line text-ink text-[15px] font-semibold cursor-pointer hover:bg-surface transition-colors"
            >
              ← Back
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={() => {
                if (canProceed()) setStep(step + 1);
              }}
              disabled={!canProceed()}
              className="flex-1 py-3.5 rounded-xl bg-brand text-white text-[15px] font-semibold cursor-pointer hover:bg-brand-hi transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={isPending}
              className="flex-1 py-3.5 rounded-xl bg-brand text-white text-[15px] font-semibold cursor-pointer hover:bg-brand-hi transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {isPending ? "Sending…" : "Send"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
