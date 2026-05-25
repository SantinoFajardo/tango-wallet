"use client";

import { useEffect, useState } from "react";
import {
  createPublicClient,
  http,
  type Address,
  encodeFunctionData,
  parseUnits,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { to7702SimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { entryPoint08Address } from "viem/account-abstraction";

const PIMLICO_API_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY ?? "";
const PIMLICO_URL = `https://api.pimlico.io/v2/ethereum/rpc?apikey=${PIMLICO_API_KEY}`;
const ETH_RPC_URL = process.env.NEXT_PUBLIC_ETH_RPC_URL ?? "https://eth.llamarpc.com";

// Simple7702Account implementation deployed by eth-infinitism (EntryPoint 0.8)
const SIMPLE_7702_IMPL: Address = "0xe6Cae83BdE06E4c305530e199D7217f42808555B";

const USDT_ADDRESS: Address = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const RECIPIENT: Address = "0xA02158a6f65485Fe71857782c9Eff4Ac891e4b72";

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function getOrCreateWallet() {
  const stored = localStorage.getItem("tango_pk");
  const pk = stored ?? generatePrivateKey();
  if (!stored) localStorage.setItem("tango_pk", pk);
  return privateKeyToAccount(pk as `0x${string}`);
}

export default function Home() {
  const [address, setAddress] = useState<Address | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const account = getOrCreateWallet();
    setAddress(account.address);
  }, []);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendSponsoredTx() {
    if (!address) return;
    setLoading(true);
    setTxHash(null);
    setStatus("Preparing EIP-7702 sponsored transaction...");

    try {
      const account = getOrCreateWallet();

      const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(ETH_RPC_URL),
      });

      const pimlicoClient = createPimlicoClient({
        transport: http(PIMLICO_URL),
        entryPoint: { address: entryPoint08Address, version: "0.8" },
      });

      const smartAccount = await to7702SimpleSmartAccount({
        client: publicClient,
        owner: account,
        entryPoint: { address: entryPoint08Address, version: "0.8" },
      });

      const smartAccountClient = createSmartAccountClient({
        account: smartAccount,
        chain: mainnet,
        bundlerTransport: http(PIMLICO_URL),
        paymaster: pimlicoClient,
        userOperation: {
          estimateFeesPerGas: async () =>
            (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
      });

      setStatus("Signing EIP-7702 authorization...");

      // Sign the authorization ourselves — prepareUserOperation only sets a stub
      // and never replaces it with the real signature before submission.
      const nonce = await publicClient.getTransactionCount({ address: account.address });
      const signedAuthorization = await account.signAuthorization({
        contractAddress: SIMPLE_7702_IMPL,
        chainId: mainnet.id,
        nonce,
      });

      setStatus("Sending sponsored transaction...");

      // Pass the pre-signed authorization directly to bypass the stub
      const userOpHash = await smartAccountClient.sendUserOperation({
        calls: [
          {
            to: USDT_ADDRESS,
            value: BigInt(0),
            data: encodeFunctionData({
              abi: ERC20_TRANSFER_ABI,
              functionName: "transfer",
              args: [RECIPIENT, parseUnits("0.5", 6)],
            }),
          },
        ],
        authorization: signedAuthorization,
      });

      setStatus("Waiting for confirmation...");

      const receipt = await smartAccountClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      setTxHash(receipt.receipt.transactionHash);
      setStatus("Transaction sent!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 bg-gray-950 text-white">
      <h1 className="text-2xl font-bold">Tango Wallet</h1>

      {address && (
        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Your address</p>
          <button
            onClick={copyAddress}
            className="w-full text-xs text-gray-300 font-mono bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-3 text-left break-all transition"
          >
            {address}
          </button>
          <p className="text-xs text-gray-500">
            {copied ? "Copied!" : "Deposit USDT here before sending"}
          </p>
        </div>
      )}

      <button
        onClick={sendSponsoredTx}
        disabled={!address || loading}
        className="rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-6 py-3 font-semibold transition w-full max-w-sm"
      >
        {loading ? "Sending..." : "Send 0.5 USDT (Sponsored)"}
      </button>

      {status && (
        <p className="text-sm text-gray-300 text-center max-w-sm">{status}</p>
      )}

      {txHash && (
        <a
          href={`https://etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 underline font-mono break-all max-w-sm"
        >
          {txHash}
        </a>
      )}
    </main>
  );
}
