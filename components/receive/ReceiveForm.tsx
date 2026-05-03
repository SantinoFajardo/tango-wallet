"use client";

import { Fragment, useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  getChains,
  getTokensByChain,
} from "@/components/dashboard/actions/assets";
import type { ChainRow, TokenRow } from "@/components/dashboard/actions/assets";
import Image from "next/image";

// ── QR Code (deterministic SVG, no library) ───────────────────────────────────

function QRCode({
  value,
  size = 200,
  color = "#18103a",
}: {
  value: string;
  size?: number;
  color?: string;
}) {
  const MODULES = 25;
  const cells: [number, number][] = [];

  const seed = value.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rand = (i: number) => {
    const x = Math.sin(seed * 9301 + i * 49297 + 233720) * 10000;
    return x - Math.floor(x);
  };

  for (let r = 0; r < MODULES; r++) {
    for (let c = 0; c < MODULES; c++) {
      const inFinder =
        (r < 7 && c < 7) ||
        (r < 7 && c >= MODULES - 7) ||
        (r >= MODULES - 7 && c < 7);
      const inTiming = r === 6 || c === 6;
      const inInner =
        (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
        (r >= 2 && r <= 4 && c >= MODULES - 5 && c <= MODULES - 3) ||
        (r >= MODULES - 5 && r <= MODULES - 3 && c >= 2 && c <= 4);

      let on = false;
      if (inFinder) {
        const fr = r < 7 ? r : r - (MODULES - 7);
        const fc = c < 7 ? c : c - (MODULES - 7);
        on =
          !(fr === 1 || fr === 5 || fc === 1 || fc === 5) ||
          (fr >= 2 && fr <= 4 && fc >= 2 && fc <= 4);
        if (r >= MODULES - 7 && c >= MODULES - 7) on = false;
      } else if (inTiming) {
        on = (r + c) % 2 === 0;
      } else if (inInner) {
        on = true;
      } else {
        on = rand(r * MODULES + c) > 0.45;
      }

      if (on) cells.push([r, c]);
    }
  }

  const cell = size / MODULES;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block" }}
    >
      <rect width={size} height={size} fill="white" rx={8} />
      {cells.map(([r, c]) => (
        <rect
          key={`${r}-${c}`}
          x={c * cell + 1}
          y={r * cell + 1}
          width={cell - 1}
          height={cell - 1}
          rx={cell * 0.15}
          fill={color}
        />
      ))}
    </svg>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = ["Network", "Token", "Address"] as const;

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
                  active
                    ? "text-brand"
                    : done
                    ? "text-ok-ink"
                    : "text-ink-faint",
                ].join(" ")}
              >
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  "flex-1 h-0.5 mb-4.5 mx-1 transition-colors",
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
  selected,
  onSelect,
}: {
  chains: ChainRow[];
  selected: ChainRow | null;
  onSelect: (chain: ChainRow) => void;
}) {
  return (
    <div>
      <h2 className="text-[22px] font-bold text-ink mb-1.5">Select network</h2>
      <p className="text-sm text-ink-faint mb-7">
        Choose the blockchain you want to receive funds on.
      </p>
      <div className="flex flex-col gap-3">
        {chains.map((chain) => {
          const active = selected?.id === chain.id;
          const color = "#8247E5";
          return (
            <button
              key={chain.id}
              onClick={() => onSelect(chain)}
              className="flex items-center gap-4 px-5 py-4.5 rounded-2xl border-2 border-line text-left transition-all cursor-pointer hover:border-line-hi bg-surface"
              style={
                active
                  ? {
                      borderColor: color,
                      background: color + "12",
                      boxShadow: `0 0 0 4px ${color}18`,
                    }
                  : undefined
              }
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
                style={{ background: color + "20", color }}
              >
                {chain.name.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-ink">{chain.name}</div>
              </div>
              <div
                className="w-5.5 h-5.5 rounded-full border-2 border-line flex items-center justify-center text-xs font-bold shrink-0"
                style={
                  active
                    ? { borderColor: color, background: color, color: "#fff" }
                    : undefined
                }
              >
                {active && "✓"}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 p-4 rounded-xl bg-tint border border-line flex items-start gap-2.5">
        <span className="text-base shrink-0">💡</span>
        <span className="text-[13px] text-ink-secondary leading-relaxed">
          Make sure the sender uses the same network. Sending on the wrong
          network may result in lost funds.
        </span>
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
  tokens: TokenRow[];
  chain: ChainRow | null;
  selected: TokenRow | null;
  onSelect: (token: TokenRow) => void;
}) {
  return (
    <div>
      <h2 className="text-[22px] font-bold text-ink mb-1.5">Select token</h2>
      <p className="text-sm text-ink-faint mb-7">
        Which token are you expecting to receive on{" "}
        <span
          className="font-semibold"
          style={{ color: chain ? "#8247E5" : undefined }}
        >
          {chain?.name}
        </span>
        ?
      </p>
      <div className="flex flex-col gap-2.5">
        {tokens.map((token) => {
          const active = selected?.id === token.id;
          const color = "#8247E5";
          return (
            <button
              key={token.id}
              onClick={() => onSelect(token)}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-line bg-surface text-left transition-all cursor-pointer hover:border-line-hi"
              style={
                active
                  ? {
                      borderColor: color,
                      background: color + "12",
                      boxShadow: `0 0 0 4px ${color}14`,
                    }
                  : undefined
              }
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: color + "22", color }}
              >
                <Image
                  src={token.image_url}
                  alt={token.name}
                  width={30}
                  height={30}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold text-ink">
                  {token.symbol}
                </div>
                <div className="text-[13px] text-ink-faint mt-0.5">
                  {token.name}
                </div>
              </div>
              <div
                className="w-5.5 h-5.5 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  borderColor: active ? color : undefined,
                  background: active ? color : "transparent",
                  color: active ? "#fff" : undefined,
                }}
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

// ── AddressStep ───────────────────────────────────────────────────────────────

function AddressStep({
  chain,
  token,
  address,
}: {
  chain: ChainRow;
  token: TokenRow;
  address: string;
}) {
  const [copied, setCopied] = useState(false);
  const color = "#8247E5";
  const tColor = "#8247E5";

  const handleCopy = () => {
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div>
      <h2 className="text-[22px] font-bold text-ink mb-1.5">
        Your deposit address
      </h2>
      <p className="text-sm text-ink-faint mb-7">
        Share this address to receive{" "}
        <span className="font-semibold" style={{ color: tColor }}>
          {token.symbol}
        </span>{" "}
        on{" "}
        <span className="font-semibold" style={{ color }}>
          {chain.name}
        </span>
        .
      </p>

      {/* Network + token pills */}
      <div className="flex gap-2 mb-6">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
          style={{ background: color + "18", color }}
        >
          {chain.name.slice(0, 1)} {chain.name}
        </span>
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
          style={{ background: tColor + "18", color: tColor }}
        >
          <Image
            src={token.image_url}
            width={15}
            height={15}
            alt={token.name}
          />{" "}
          {token.symbol}
        </span>
      </div>

      {/* QR + address card */}
      <div className="bg-surface rounded-2xl border border-line overflow-hidden shadow-lg mb-5">
        {/* QR area */}
        <div className="flex flex-col items-center px-8 pt-8 pb-6 border-b border-line bg-surface">
          <div
            className="p-4 rounded-2xl relative"
            style={{
              background: "#fff",
              boxShadow: `0 0 0 2px ${color}30, 0 8px 32px rgba(0,0,0,0.10)`,
            }}
          >
            <QRCode value={address} size={192} color={color} />
            {/* Center logo */}
            <div
              className="absolute flex items-center justify-center text-white text-base font-bold rounded-xl"
              style={{
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 36,
                height: 36,
                background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              T
            </div>
          </div>
          <p className="text-xs text-ink-faint mt-4 text-center">
            Scan with any wallet app
          </p>
        </div>

        {/* Address row */}
        <div className="px-6 py-5">
          <div className="text-[11px] font-bold text-ink-faint uppercase tracking-widest mb-2">
            Wallet address
          </div>
          <div className="flex items-center gap-2.5 bg-layer rounded-xl px-4 py-3 border border-line">
            <div className="flex-1 text-[13px] font-mono text-ink font-medium break-all leading-relaxed">
              {address}
            </div>
            <button
              onClick={handleCopy}
              className="shrink-0 px-3.5 py-2 rounded-lg text-[13px] font-semibold text-white transition-all cursor-pointer border-none"
              style={{
                background: copied
                  ? "oklch(68% 0.20 155)"
                  : "linear-gradient(135deg, #7c3aed, #4c1d95)",
                transform: copied ? "scale(1.05)" : "scale(1)",
              }}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* Share row */}
        <div className="px-6 pb-5 flex gap-2.5">
          <button
            className="flex-1 py-2.5 rounded-xl bg-layer border border-line text-ink-secondary text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:border-brand transition-colors"
            onClick={() => {
              const link = document.createElement("a");
              link.download = "deposit-qr.svg";
              link.click();
            }}
          >
            ⬇ Save QR
          </button>
          <button
            className="flex-1 py-2.5 rounded-xl bg-layer border border-line text-ink-secondary text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:border-brand transition-colors"
            onClick={() => {
              if (navigator.share) {
                navigator
                  .share({ title: "My Tango Wallet Address", text: address })
                  .catch(() => {});
              } else {
                handleCopy();
              }
            }}
          >
            ↗ Share address
          </button>
        </div>
      </div>

      {/* Warning */}
      <div
        className="px-4 py-3.5 rounded-xl text-[13px] leading-relaxed"
        style={{
          background: "oklch(75% 0.15 60 / 0.10)",
          border: "1px solid oklch(75% 0.15 60 / 0.3)",
          color: "oklch(40% 0.12 60)",
        }}
      >
        ⚠️ Only send <strong>{token.symbol}</strong> on{" "}
        <strong>{chain.name}</strong> to this address. Sending a different token
        or using the wrong network may result in permanent loss of funds.
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ReceiveForm() {
  const account = useActiveAccount();
  const address = account?.address ?? "";

  const [step, setStep] = useState(0);
  const [chains, setChains] = useState<ChainRow[]>([]);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainRow | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenRow | null>(null);
  const [loadingChains, setLoadingChains] = useState(true);
  const [loadingTokens, setLoadingTokens] = useState(false);

  useEffect(() => {
    getChains()
      .then(setChains)
      .finally(() => setLoadingChains(false));
  }, []);

  const selectChain = async (chain: ChainRow) => {
    setSelectedChain(chain);
    setSelectedToken(null);
    setLoadingTokens(true);
    try {
      const t = await getTokensByChain(chain.chain_id);
      setTokens(t);
    } finally {
      setLoadingTokens(false);
    }
  };

  const canProceed =
    [() => !!selectedChain, () => !!selectedToken, () => true][step]?.() ??
    false;

  const handleNext = () => {
    if (step < 2) setStep(step + 1);
  };
  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };
  const handleReset = () => {
    setStep(0);
    setSelectedChain(null);
    setSelectedToken(null);
  };

  return (
    <div>
      <StepBar current={step} />

      <div className="bg-surface rounded-2xl border border-line p-8 shadow-lg">
        {loadingChains ? (
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-layer animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {step === 0 && (
              <ChainStep
                chains={chains}
                selected={selectedChain}
                onSelect={selectChain}
              />
            )}
            {step === 1 &&
              (loadingTokens ? (
                <div className="flex flex-col gap-2.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-2xl bg-layer animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <TokenStep
                  tokens={tokens}
                  chain={selectedChain}
                  selected={selectedToken}
                  onSelect={setSelectedToken}
                />
              ))}
            {step === 2 && selectedChain && selectedToken && address && (
              <AddressStep
                chain={selectedChain}
                token={selectedToken}
                address={address}
              />
            )}
          </>
        )}

        {/* Nav buttons */}
        {step < 2 && (
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button
                onClick={handleBack}
                className="px-6 py-3 rounded-xl bg-layer border border-line text-ink-secondary text-[15px] font-semibold cursor-pointer"
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className={[
                "flex-1 py-3.5 rounded-xl text-[15px] font-bold transition-all border-none",
                canProceed
                  ? "text-white cursor-pointer"
                  : "bg-layer text-ink-faint cursor-not-allowed",
              ].join(" ")}
              style={
                canProceed
                  ? { background: "linear-gradient(135deg, #7c3aed, #4c1d95)" }
                  : undefined
              }
            >
              Continue →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex gap-3 mt-7">
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-xl bg-layer border border-line text-ink-secondary text-[15px] font-semibold cursor-pointer"
            >
              ← Back
            </button>
            <button
              onClick={handleReset}
              className="flex-1 py-3.5 rounded-xl bg-tint border border-line text-brand text-[15px] font-bold cursor-pointer"
            >
              Deposit another token
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
