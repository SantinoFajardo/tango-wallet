"use client";

import { useEffect, useState } from "react";
import {
  useActiveAccount,
  useSendAndConfirmTransaction,
  useSwitchActiveWalletChain,
  useWalletBalance,
} from "thirdweb/react";
import { defineChain, getContract, prepareContractCall, prepareTransaction } from "thirdweb";
import { isAddress, toWei } from "thirdweb/utils";
import { client } from "@/lib/client";
import { getChains, getTokensByChain } from "@/components/dashboard/actions/assets";
import type { ChainRow, TokenRow } from "@/components/dashboard/actions/assets";
import { recordSponsoredTransaction } from "@/components/dashboard/actions/transactions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SelectModal } from "@/components/send/SelectModal";

function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = amount.split(".");
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

export function SendForm() {
  const account = useActiveAccount();
  const { mutate: sendAndConfirm, isPending } = useSendAndConfirmTransaction();
  const switchChain = useSwitchActiveWalletChain();

  const [chains, setChains] = useState<ChainRow[]>([]);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainRow | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenRow | null>(null);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingChains, setLoadingChains] = useState(true);
  const [loadingTokens, setLoadingTokens] = useState(false);

  const thirdwebChain = selectedChain ? defineChain(selectedChain.chain_id) : undefined;
  const { data: tokenBalance, isLoading: balanceLoading } = useWalletBalance({
    client,
    chain: thirdwebChain,
    address: account?.address,
    tokenAddress: selectedToken?.contract_address ?? undefined,
  });

  useEffect(() => {
    getChains()
      .then((data) => {
        setChains(data);
        if (data.length > 0) setSelectedChain(data[0]);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load chains"))
      .finally(() => setLoadingChains(false));
  }, []);

  useEffect(() => {
    if (!selectedChain) return;
    setLoadingTokens(true);
    setSelectedToken(null);
    setTokens([]);
    getTokensByChain(selectedChain.chain_id)
      .then((data) => {
        setTokens(data);
        if (data.length > 0) setSelectedToken(data[0]);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load tokens"))
      .finally(() => setLoadingTokens(false));
  }, [selectedChain]);

  async function handleSend() {
    if (!account || !selectedChain || !selectedToken) return;
    setError(null);
    setTxHash(null);

    if (!isAddress(recipient)) {
      setError("Enter a valid Ethereum address.");
      return;
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (tokenBalance && parseFloat(amount) > parseFloat(tokenBalance.displayValue)) {
      setError(`Insufficient balance. You have ${tokenBalance.displayValue} ${tokenBalance.symbol}.`);
      return;
    }

    const thirdwebChain = defineChain(selectedChain.chain_id);
    await switchChain(thirdwebChain);

    const tx = selectedToken.is_native
      ? prepareTransaction({ to: recipient, value: toWei(amount), chain: thirdwebChain, client })
      : prepareContractCall({
        contract: getContract({ client, chain: thirdwebChain, address: selectedToken.contract_address! }),
        method: "function transfer(address to, uint256 amount) returns (bool)",
        params: [recipient as `0x${string}`, parseTokenAmount(amount, selectedToken.decimals)],
      });

    sendAndConfirm(tx, {
      onSuccess: (receipt) => {
        setTxHash(receipt.transactionHash);
        setAmount("");
        setRecipient("");
        recordSponsoredTransaction(account.address, {
          txHash: receipt.transactionHash,
          chainId: selectedChain.chain_id,
          chainNativeSymbol: selectedToken.is_native ? selectedToken.symbol : "ETH",
          gasUsed: receipt.gasUsed.toString(),
          gasPrice: receipt.effectiveGasPrice.toString(),
          tokenSymbol: selectedToken.symbol,
          receiverAddress: recipient,
        }).catch(console.error);
      },
      onError: (e) => setError(e.message?.slice(0, 200) ?? "Transaction failed"),
    });
  }

  if (!account) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-ink-dim">
        Connect your wallet to send tokens.
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <SelectModal
        items={chains}
        selected={selectedChain}
        onSelect={setSelectedChain}
        label="Network"
        placeholder="Select a network"
        loading={loadingChains}
      />

      <SelectModal
        items={tokens}
        selected={selectedToken}
        onSelect={setSelectedToken}
        label="Token"
        placeholder="Select a token"
        loading={loadingTokens}
        disabled={!selectedChain}
      />

      <Input
        label="Recipient address"
        type="text"
        placeholder="0x..."
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        inputSize="lg"
      />

      <div className="space-y-1">
        <Input
          label="Amount"
          type="number"
          min="0"
          step="any"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputSize="lg"
          suffix={selectedToken?.symbol}
        />
        {selectedToken && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-ink-faint">
              {balanceLoading
                ? "Loading balance…"
                : tokenBalance
                ? `Balance: ${tokenBalance.displayValue} ${tokenBalance.symbol}`
                : "Balance unavailable"}
            </span>
            {tokenBalance && !balanceLoading && (
              <button
                type="button"
                onClick={() => setAmount(tokenBalance.displayValue)}
                className="text-xs font-medium text-brand hover:underline"
              >
                Max
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-err-ink text-xs">{error}</p>}

      {txHash && (
        <div className="rounded-xl border border-ok-rim bg-ok-wash px-4 py-3">
          <p className="text-ok-ink text-sm font-medium">Transaction confirmed!</p>
          <p className="text-ink-dim text-xs font-mono mt-1 break-all">{txHash}</p>
          {selectedChain?.explorer_url && (
            <a
              href={`${selectedChain.explorer_url}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link text-xs underline mt-1 inline-block"
            >
              View on explorer →
            </a>
          )}
        </div>
      )}

      <Button
        onClick={handleSend}
        disabled={!recipient || !amount || !selectedToken || !selectedChain}
        loading={isPending}
        fullWidth
        size="lg"
      >
        Send
      </Button>
    </div>
  );
}
