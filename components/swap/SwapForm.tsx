"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bridge,
  NATIVE_TOKEN_ADDRESS,
  sendAndConfirmTransaction,
  defineChain,
} from "thirdweb";
import { useActiveAccount, useSwitchActiveWalletChain } from "thirdweb/react";
import { client } from "@/lib/client";
import {
  getChains,
  getTokensForSwap,
} from "@/components/dashboard/actions/assets";
import type {
  ChainRow,
  SwapToken,
} from "@/components/dashboard/actions/assets";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseAmount(val: string, decimals: number): bigint {
  if (!val || isNaN(parseFloat(val))) return 0n;
  const [whole = "0", frac = ""] = val.split(".");
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

function fmtAmount(raw: bigint, decimals: number, maxDec = 6): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  if (frac === 0n) return whole.toString();
  const s = frac
    .toString()
    .padStart(decimals, "0")
    .slice(0, maxDec)
    .replace(/0+$/, "");
  return s ? `${whole}.${s}` : whole.toString();
}

function fmtUSD(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtBalance(n: number): string {
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function tokenAddr(t: SwapToken): `0x${string}` {
  return (t.contract_address ?? NATIVE_TOKEN_ADDRESS) as `0x${string}`;
}

type Quote = {
  originAmount: bigint;
  destinationAmount: bigint;
  estimatedExecutionTimeMs?: number;
};

// ── TokenIcon ─────────────────────────────────────────────────────────────────

function TokenIcon({ token, size = 28 }: { token: SwapToken; size?: number }) {
  if (token.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={token.image_url}
        alt=""
        width={size}
        height={size}
        className="rounded-full shrink-0"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        background: "var(--brand)",
        fontSize: Math.round(size * 0.3),
      }}
    >
      {token.symbol.slice(0, 2)}
    </div>
  );
}

// ── ChainIcon ─────────────────────────────────────────────────────────────────

function ChainIcon({ chain, size = 16 }: { chain: ChainRow; size?: number }) {
  if (chain.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={chain.image_url}
        alt=""
        width={size}
        height={size}
        className="rounded-full shrink-0"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }
  return null;
}

// ── TokenButton ───────────────────────────────────────────────────────────────

function TokenButton({
  token,
  chain,
  onClick,
}: {
  token: SwapToken | null;
  chain: ChainRow | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-sm transition-all shrink-0"
      style={
        token
          ? {
              background: "var(--tint)",
              color: "var(--tint-ink)",
              border: "1px solid var(--tint-rim)",
            }
          : {
              background: "var(--brand)",
              color: "var(--brand-on)",
              border: "none",
            }
      }
    >
      {token ? (
        <>
          <div className="relative shrink-0">
            <TokenIcon token={token} size={22} />
            {chain?.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={chain.image_url}
                alt=""
                width={12}
                height={12}
                className="rounded-full absolute -bottom-0.5 -right-0.5 ring-1 ring-white"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
          </div>
          <span>{token.symbol}</span>
          <span style={{ opacity: 0.5, fontSize: 10 }}>▾</span>
        </>
      ) : (
        <span>Select ▾</span>
      )}
    </button>
  );
}

// ── TokenPickerModal ──────────────────────────────────────────────────────────

interface TokenPickerModalProps {
  title: string;
  chains: ChainRow[];
  userAddress: string;
  onSelect: (token: SwapToken, chain: ChainRow) => void;
  onClose: () => void;
  exclude?: SwapToken | null;
}

function TokenPickerModal({
  title,
  chains,
  userAddress,
  onSelect,
  onClose,
  exclude,
}: TokenPickerModalProps) {
  const [selectedChain, setSelectedChain] = useState<ChainRow | null>(
    chains[0] ?? null
  );
  const [tokens, setTokens] = useState<SwapToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!selectedChain) return;
    setLoading(true);
    setTokens([]);
    setTokenError(null);
    getTokensForSwap(userAddress, selectedChain.chain_id)
      .then(setTokens)
      .catch((e: unknown) =>
        setTokenError(e instanceof Error ? e.message : "Failed to load tokens")
      )
      .finally(() => setLoading(false));
  }, [selectedChain, userAddress]);

  const filtered = tokens
    .filter(
      (t) =>
        t.id !== exclude?.id &&
        (search === "" ||
          t.symbol.toLowerCase().includes(search.toLowerCase()) ||
          t.name.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      // Tokens with balance first, then native, then alphabetical
      if (b.display_balance !== a.display_balance)
        return b.display_balance - a.display_balance;
      if (a.is_native !== b.is_native) return a.is_native ? -1 : 1;
      return a.symbol.localeCompare(b.symbol);
    });

  if (chains.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-8 text-center space-y-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-2xl">⛓</p>
          <p className="font-bold text-ink">No chains configured</p>
          <p className="text-sm text-ink-faint">
            Run{" "}
            <code
              className="font-mono text-xs px-1 py-0.5 rounded"
              style={{ background: "var(--layer)" }}
            >
              seed_chains_tokens.sql
            </code>{" "}
            in Supabase to add supported chains and tokens.
          </p>
          <button
            onClick={onClose}
            className="mt-2 text-sm font-semibold"
            style={{ color: "var(--brand)" }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="font-bold text-ink text-base">{title}</span>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-4 pt-3">
          <input
            type="text"
            placeholder="Search by name or symbol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full px-4 py-2.5 rounded-xl text-sm text-ink"
            style={{
              background: "var(--layer)",
              border: "1px solid var(--line)",
              outline: "none",
            }}
          />
        </div>

        {/* Chain tabs */}
        <div
          className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {chains.map((c) => (
            <button
              key={c.chain_id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedChain(c);
                setSearch("");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all"
              style={{
                background:
                  selectedChain?.chain_id === c.chain_id
                    ? "var(--tint)"
                    : "var(--layer)",
                color:
                  selectedChain?.chain_id === c.chain_id
                    ? "var(--tint-ink)"
                    : "var(--ink-faint)",
                border: `1px solid ${
                  selectedChain?.chain_id === c.chain_id
                    ? "var(--tint-rim)"
                    : "var(--line)"
                }`,
              }}
            >
              <ChainIcon chain={c} size={14} />
              {c.name}
            </button>
          ))}
        </div>

        {/* Token list */}
        <div
          className="overflow-y-auto px-2 pb-4 mt-2"
          style={{ maxHeight: 320 }}
        >
          {loading ? (
            <div className="flex justify-center py-10">
              <span className="w-5 h-5 rounded-full border-2 border-line border-t-brand animate-spin" />
            </div>
          ) : tokenError ? (
            <p
              className="text-center text-xs py-8 px-4"
              style={{ color: "var(--err-ink)" }}
            >
              {tokenError}
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-ink-faint text-sm py-8">
              {tokens.length === 0
                ? "No tokens configured for this chain"
                : "No tokens match your search"}
            </p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(t, selectedChain!);
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left"
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--layer)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <TokenIcon token={t} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">{t.symbol}</p>
                  <p className="text-xs text-ink-faint truncate">{t.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color:
                        t.display_balance > 0
                          ? "var(--ink)"
                          : "var(--ink-faint)",
                    }}
                  >
                    {fmtBalance(t.display_balance)}
                  </p>
                  {t.price_usd > 0 && t.display_balance > 0 && (
                    <p className="text-xs text-ink-faint">
                      ${fmtUSD(t.display_balance * t.price_usd)}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── SettingsPopover ───────────────────────────────────────────────────────────

function SettingsPopover({
  slippage,
  onChange,
}: {
  slippage: number;
  onChange: (v: number) => void;
}) {
  const [custom, setCustom] = useState("");
  const presets = [0.1, 0.5, 1.0];

  return (
    <div
      className="absolute top-8 right-0 z-40 rounded-2xl p-4 w-60 shadow-xl"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      <p className="text-sm font-bold text-ink mb-3">Slippage tolerance</p>
      <div className="flex gap-2 mb-3">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => {
              onChange(p);
              setCustom("");
            }}
            className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background:
                slippage === p && !custom ? "var(--brand)" : "var(--layer)",
              color:
                slippage === p && !custom
                  ? "var(--brand-on)"
                  : "var(--ink-dim)",
            }}
          >
            {p}%
          </button>
        ))}
      </div>
      <input
        type="number"
        placeholder="Custom %"
        value={custom}
        onChange={(e) => {
          setCustom(e.target.value);
          const n = parseFloat(e.target.value);
          if (!isNaN(n) && n > 0) onChange(n);
        }}
        className="w-full px-3 py-2 rounded-xl text-sm text-ink"
        style={{
          background: "var(--layer)",
          border: "1px solid var(--line)",
          outline: "none",
        }}
      />
      <p className="text-xs text-ink-faint mt-2 leading-relaxed">
        Higher slippage = higher chance of success but worse rate.
      </p>
    </div>
  );
}

// ── ConfirmModal ──────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  fromToken: SwapToken;
  toToken: SwapToken;
  amount: string;
  quote: Quote | null;
  slippage: number;
  onConfirm: () => void;
  onClose: () => void;
  executing: boolean;
  execPhase: string;
  execError: string | null;
}

function ConfirmModal({
  fromToken,
  toToken,
  amount,
  quote,
  slippage,
  onConfirm,
  onClose,
  executing,
  execPhase,
  execError,
}: ConfirmModalProps) {
  const receiveAmt = quote
    ? fmtAmount(quote.destinationAmount, toToken.decimals)
    : "—";
  const fromPrice = fromToken.price_usd;
  const toPrice = toToken.price_usd;
  const rateStr =
    fromPrice > 0 && toPrice > 0
      ? `1 ${fromToken.symbol} ≈ ${(fromPrice / toPrice).toFixed(4)} ${
          toToken.symbol
        }`
      : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="font-bold text-ink text-base">Confirm swap</span>
          {!executing && (
            <button
              onClick={onClose}
              className="text-ink-faint hover:text-ink text-xl leading-none"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div
            className="p-4 rounded-xl"
            style={{ background: "var(--layer)" }}
          >
            <p className="text-xs text-ink-faint mb-2">You pay</p>
            <div className="flex items-center gap-3">
              <TokenIcon token={fromToken} size={40} />
              <div>
                <p className="text-xl font-bold text-ink">
                  {amount} {fromToken.symbol}
                </p>
                {fromPrice > 0 && (
                  <p className="text-xs text-ink-faint">
                    ≈ ${fmtUSD(parseFloat(amount) * fromPrice)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center text-ink-faint text-lg">↓</div>

          <div
            className="p-4 rounded-xl"
            style={{
              background: "var(--tint)",
              border: "1px solid var(--tint-rim)",
            }}
          >
            <p
              className="text-xs font-semibold mb-2"
              style={{ color: "var(--tint-ink)", opacity: 0.7 }}
            >
              You receive (est.)
            </p>
            <div className="flex items-center gap-3">
              <TokenIcon token={toToken} size={40} />
              <div>
                <p
                  className="text-xl font-bold"
                  style={{ color: "var(--tint-ink)" }}
                >
                  ≈ {receiveAmt} {toToken.symbol}
                </p>
                {toPrice > 0 && receiveAmt !== "—" && (
                  <p
                    className="text-xs"
                    style={{ color: "var(--tint-ink)", opacity: 0.6 }}
                  >
                    ≈ ${fmtUSD(parseFloat(receiveAmt) * toPrice)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 px-1">
            {[
              { label: "Rate", value: rateStr },
              { label: "Slippage", value: `${slippage}%` },
              { label: "Network fee", value: "FREE · Sponsored ⛽", ok: true },
            ].map(({ label, value, ok }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-ink-faint">{label}</span>
                <span
                  className="font-semibold"
                  style={{ color: ok ? "var(--ok-ink)" : "var(--ink)" }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {slippage > 1 && (
            <div
              className="p-3 rounded-xl text-xs"
              style={{
                background: "rgba(234,179,8,0.1)",
                border: "1px solid rgba(234,179,8,0.3)",
                color: "#92400e",
              }}
            >
              ⚠ High slippage. You may receive significantly less than shown.
            </div>
          )}

          {execError && (
            <div
              className="p-3 rounded-xl text-xs"
              style={{
                background: "var(--err-wash)",
                border: "1px solid var(--err-rim)",
                color: "var(--err-ink)",
              }}
            >
              {execError}
            </div>
          )}

          <button
            onClick={onConfirm}
            disabled={executing}
            className="w-full py-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4c1d95)" }}
          >
            {executing ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                {execPhase || "Processing…"}
              </>
            ) : (
              "Confirm swap"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── StatusModal ───────────────────────────────────────────────────────────────

interface StatusModalProps {
  status: "success" | "error";
  fromToken: SwapToken;
  toToken: SwapToken;
  amount: string;
  destAmount: bigint;
  txHash?: string;
  error?: string;
  onReset: () => void;
}

function StatusModal({
  status,
  fromToken,
  toToken,
  amount,
  destAmount,
  txHash,
  error,
  onReset,
}: StatusModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
        }}
      >
        {status === "success" ? (
          <>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-5"
              style={{
                background: "var(--ok-wash)",
                border: "2px solid var(--ok-rim)",
              }}
            >
              ✓
            </div>
            <h2 className="text-2xl font-bold text-ink mb-1">
              Swap successful!
            </h2>
            <p className="text-ink-faint text-sm mb-2">
              {amount} {fromToken.symbol} →{" "}
              {fmtAmount(destAmount, toToken.decimals)} {toToken.symbol}
            </p>
            {txHash && (
              <p className="text-xs font-mono text-ink-faint mb-6 break-all px-2">
                {txHash.slice(0, 18)}…{txHash.slice(-8)}
              </p>
            )}
            <div className="flex gap-3">
              <Link
                href="/"
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-center"
                style={{
                  background: "var(--layer)",
                  border: "1px solid var(--line)",
                  color: "var(--ink-dim)",
                }}
              >
                ← Portfolio
              </Link>
              <button
                onClick={onReset}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
                }}
              >
                Swap again
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-5"
              style={{ background: "var(--err-wash)" }}
            >
              ✕
            </div>
            <h2 className="text-2xl font-bold text-ink mb-2">Swap failed</h2>
            <p className="text-sm text-ink-faint mb-6">{error}</p>
            <button
              onClick={onReset}
              className="w-full py-3 rounded-xl text-sm font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
              }}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main SwapForm ─────────────────────────────────────────────────────────────

export function SwapForm() {
  const account = useActiveAccount();
  const switchChain = useSwitchActiveWalletChain();

  const [chains, setChains] = useState<ChainRow[]>([]);
  const [chainsLoading, setChainsLoading] = useState(true);

  const [fromToken, setFromToken] = useState<SwapToken | null>(null);
  const [fromChain, setFromChain] = useState<ChainRow | null>(null);
  const [toToken, setToToken] = useState<SwapToken | null>(null);
  const [toChain, setToChain] = useState<ChainRow | null>(null);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [flipDeg, setFlipDeg] = useState(0);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [tokenPickerFor, setTokenPickerFor] = useState<"from" | "to" | null>(
    null
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [swapStatus, setSwapStatus] = useState<"success" | "error" | null>(
    null
  );

  const [executing, setExecuting] = useState(false);
  const [execPhase, setExecPhase] = useState("");
  const [execError, setExecError] = useState<string | null>(null);
  const [finalDestAmount, setFinalDestAmount] = useState(0n);
  const [finalTxHash, setFinalTxHash] = useState<string | undefined>();

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getChains()
      .then((data) => {
        console.log({ data });
        setChains(data);
      })
      .catch(console.error)
      .finally(() => setChainsLoading(false));
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node)
      ) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const fetchQuote = useCallback(() => {
    if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const amountWei = parseAmount(amount, fromToken.decimals);
    if (amountWei === 0n) return;

    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    setQuoteLoading(true);
    setQuoteError(null);

    quoteTimer.current = setTimeout(() => {
      Bridge.Sell.quote({
        originChainId: fromToken.chain_id,
        originTokenAddress: tokenAddr(fromToken),
        destinationChainId: toToken.chain_id,
        destinationTokenAddress: tokenAddr(toToken),
        amount: amountWei,
        client,
      })
        .then((q) => {
          setQuote({
            originAmount: q.originAmount,
            destinationAmount: q.destinationAmount,
            estimatedExecutionTimeMs: q.estimatedExecutionTimeMs ?? undefined,
          });
          setQuoteError(null);
        })
        .catch((e: Error) => {
          setQuote(null);
          setQuoteError(
            e.message?.includes("no routes")
              ? "No route found for this pair"
              : "Unable to get quote"
          );
        })
        .finally(() => setQuoteLoading(false));
    }, 600);
  }, [fromToken, toToken, amount]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  async function handleExecute() {
    if (!account || !fromToken || !toToken || !amount) return;

    setExecuting(true);
    setExecError(null);

    try {
      const amountWei = parseAmount(amount, fromToken.decimals);

      setExecPhase("Preparing swap…");
      const prepared = await Bridge.Sell.prepare({
        originChainId: fromToken.chain_id,
        originTokenAddress: tokenAddr(fromToken),
        destinationChainId: toToken.chain_id,
        destinationTokenAddress: tokenAddr(toToken),
        amount: amountWei,
        sender: account.address,
        receiver: account.address,
        client,
      });

      setExecPhase("Switching network…");
      await switchChain(defineChain(fromToken.chain_id));

      let lastHash: string | undefined;
      for (const swapStep of prepared.steps) {
        for (const tx of swapStep.transactions) {
          setExecPhase(
            tx.action === "approval"
              ? "Approving token…"
              : fromToken.chain_id !== toToken.chain_id
              ? "Bridging…"
              : "Swapping…"
          );
          const receipt = await sendAndConfirmTransaction({
            transaction: tx,
            account,
          });
          lastHash = receipt.transactionHash;
        }
      }

      setFinalDestAmount(prepared.destinationAmount);
      setFinalTxHash(lastHash);
      setShowConfirm(false);
      setSwapStatus("success");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message.slice(0, 200) : "Transaction failed";
      setExecError(msg);
      setShowConfirm(false);
      setSwapStatus("error");
    } finally {
      setExecuting(false);
      setExecPhase("");
    }
  }

  function handleFlip() {
    setFlipDeg((d) => d + 180);
    setFromToken(toToken);
    setFromChain(toChain);
    setToToken(fromToken);
    setToChain(fromChain);
    setAmount("");
    setQuote(null);
    setQuoteError(null);
  }

  function handleReset() {
    setFromToken(null);
    setFromChain(null);
    setToToken(null);
    setToChain(null);
    setAmount("");
    setQuote(null);
    setQuoteError(null);
    setSwapStatus(null);
    setFinalDestAmount(0n);
    setFinalTxHash(undefined);
    setExecError(null);
    setShowConfirm(false);
  }

  const hasAmount = !!amount && parseFloat(amount) > 0;
  const canReview =
    hasAmount &&
    !!fromToken &&
    !!toToken &&
    !!quote &&
    !quoteLoading &&
    !quoteError &&
    !!account;

  const receiveAmt =
    quote && toToken
      ? fmtAmount(quote.destinationAmount, toToken.decimals)
      : "";
  const fromPrice = fromToken?.price_usd ?? 0;
  const toPrice = toToken?.price_usd ?? 0;
  const usdValue =
    hasAmount && fromPrice ? parseFloat(amount) * fromPrice : null;

  function ctaLabel() {
    if (!account) return "Connect wallet to swap";
    if (!fromToken || !toToken) return "Select tokens";
    if (!hasAmount) return "Enter an amount";
    if (quoteLoading) return "Fetching quote…";
    if (quoteError) return quoteError;
    return "Review swap";
  }

  return (
    <>
      <div
        className="rounded-2xl overflow-visible"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="text-sm font-bold text-ink">Swap tokens</span>
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings((s) => !s)}
              className="text-ink-faint hover:text-ink transition-colors text-xl leading-none"
              title="Slippage settings"
            >
              ⚙
            </button>
            {showSettings && (
              <SettingsPopover slippage={slippage} onChange={setSlippage} />
            )}
          </div>
        </div>

        <div className="p-5 space-y-2">
          {/* You pay */}
          <div
            className="p-4 rounded-2xl"
            style={{
              background: "var(--layer)",
              border: "1px solid var(--line)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">
                You pay
              </span>
              {fromToken && fromToken.display_balance > 0 && (
                <button
                  className="text-xs font-semibold px-2 py-0.5 rounded-md"
                  style={{ color: "var(--brand)", background: "var(--tint)" }}
                  onClick={() =>
                    setAmount(
                      fromToken.display_balance.toFixed(
                        fromToken.decimals > 6 ? 6 : fromToken.decimals
                      )
                    )
                  }
                >
                  MAX {fmtBalance(fromToken.display_balance)}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 text-3xl font-bold bg-transparent border-none outline-none text-ink"
                style={{ minWidth: 0 }}
              />
              <TokenButton
                token={fromToken}
                chain={fromChain}
                onClick={() => !chainsLoading && setTokenPickerFor("from")}
              />
            </div>
            <p className="text-xs text-ink-faint mt-2 h-4">
              {usdValue != null
                ? `≈ $${fmtUSD(usdValue)}`
                : fromToken
                ? "Enter an amount"
                : "Select a token to start"}
            </p>
          </div>

          {/* Flip */}
          <div className="flex justify-center py-0.5">
            <button
              onClick={handleFlip}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold"
              style={{
                background: "var(--surface)",
                border: "2px solid var(--line)",
                color: "var(--ink-dim)",
                transform: `rotate(${flipDeg}deg)`,
                transition: "transform 0.3s ease",
              }}
            >
              ⇅
            </button>
          </div>

          {/* You receive */}
          <div
            className="p-4 rounded-2xl"
            style={{
              background: "var(--layer)",
              border: "1px solid var(--line)",
            }}
          >
            <div className="mb-3">
              <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">
                You receive
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {quoteLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-line border-t-brand animate-spin shrink-0" />
                    <span className="text-ink-faint text-sm">
                      Fetching quote…
                    </span>
                  </div>
                ) : (
                  <p
                    className="text-3xl font-bold truncate"
                    style={{
                      color: receiveAmt ? "var(--ok-ink)" : "var(--ink-faint)",
                      opacity: receiveAmt ? 1 : 0.3,
                    }}
                  >
                    {receiveAmt || "0"}
                  </p>
                )}
              </div>
              <TokenButton
                token={toToken}
                chain={toChain}
                onClick={() => !chainsLoading && setTokenPickerFor("to")}
              />
            </div>
            <p className="text-xs text-ink-faint mt-2 h-4">
              {toPrice > 0 && receiveAmt
                ? `≈ $${fmtUSD(parseFloat(receiveAmt) * toPrice)}`
                : ""}
            </p>
          </div>

          {/* Quote details */}
          {quote && fromToken && toToken && !quoteError && (
            <div
              className="rounded-xl px-4 py-3 space-y-1.5"
              style={{
                background: "var(--layer)",
                border: "1px solid var(--line)",
              }}
            >
              {fromPrice > 0 && toPrice > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-ink-faint">Rate</span>
                  <span className="text-ink font-semibold">
                    1 {fromToken.symbol} ≈ {(fromPrice / toPrice).toFixed(4)}{" "}
                    {toToken.symbol}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-ink-faint">Slippage</span>
                <span className="text-ink font-semibold">{slippage}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ink-faint">Network fee</span>
                <span
                  className="font-semibold"
                  style={{ color: "var(--ok-ink)" }}
                >
                  FREE · Sponsored ⛽
                </span>
              </div>
              {fromToken.chain_id !== toToken.chain_id &&
                quote.estimatedExecutionTimeMs && (
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-faint">Est. bridge time</span>
                    <span className="text-ink font-semibold">
                      ~{Math.ceil(quote.estimatedExecutionTimeMs / 1000)}s
                    </span>
                  </div>
                )}
            </div>
          )}

          {quoteError && (
            <div
              className="p-3 rounded-xl text-xs text-center"
              style={{ background: "var(--err-wash)", color: "var(--err-ink)" }}
            >
              {quoteError}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={() => canReview && setShowConfirm(true)}
            disabled={!canReview}
            className="w-full py-4 rounded-2xl font-bold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4c1d95)" }}
          >
            {ctaLabel()}
          </button>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 border-t text-xs text-center text-ink-faint"
          style={{ borderColor: "var(--line)" }}
        >
          ⛽ All swaps are gas-free on Tango. Routed via best available pool.
        </div>
      </div>

      {/* Token picker modal */}
      {tokenPickerFor && !chainsLoading && (
        <TokenPickerModal
          title={tokenPickerFor === "from" ? "You pay" : "You receive"}
          chains={chains}
          userAddress={account?.address ?? ""}
          exclude={tokenPickerFor === "from" ? toToken : fromToken}
          onSelect={(t, c) => {
            if (tokenPickerFor === "from") {
              setFromToken(t);
              setFromChain(c);
            } else {
              setToToken(t);
              setToChain(c);
            }
            setAmount("");
            setQuote(null);
            setQuoteError(null);
          }}
          onClose={() => setTokenPickerFor(null)}
        />
      )}

      {/* Confirm modal */}
      {showConfirm && fromToken && toToken && (
        <ConfirmModal
          fromToken={fromToken}
          toToken={toToken}
          amount={amount}
          quote={quote}
          slippage={slippage}
          onConfirm={handleExecute}
          onClose={() => !executing && setShowConfirm(false)}
          executing={executing}
          execPhase={execPhase}
          execError={execError}
        />
      )}

      {/* Status modal */}
      {swapStatus && fromToken && toToken && (
        <StatusModal
          status={swapStatus}
          fromToken={fromToken}
          toToken={toToken}
          amount={amount}
          destAmount={finalDestAmount}
          txHash={finalTxHash}
          error={execError ?? undefined}
          onReset={handleReset}
        />
      )}
    </>
  );
}
