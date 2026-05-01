"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getNativeTokenPriceUSD } from "@/lib/prices";

export interface SponsoredTxInput {
  txHash: string;
  chainId: number;
  chainNativeSymbol: string;
  gasUsed: string;   // bigint serialized as string
  gasPrice: string;  // bigint serialized as string (effectiveGasPrice)
  tokenSymbol: string;
  receiverAddress: string;
}

export async function recordSponsoredTransaction(
  userAddress: string,
  tx: SponsoredTxInput,
): Promise<void> {
  const supabase = createServerClient();

  const gasUsedBig = BigInt(tx.gasUsed);
  const gasPriceBig = BigInt(tx.gasPrice);
  const sponsoredGasWei = gasUsedBig * gasPriceBig;

  const nativePrice = await getNativeTokenPriceUSD(tx.chainNativeSymbol);
  const sponsoredGasEth = Number(sponsoredGasWei) / 1e18;
  const sponsoredGasUsd = sponsoredGasEth * nativePrice;

  // Insert the transaction row (ignore if already recorded via the unique constraint).
  const { error: txError } = await supabase
    .from("sponsored_transactions")
    .upsert(
      {
        user_address: userAddress,
        tx_hash: tx.txHash,
        chain_id: tx.chainId,
        gas_used: tx.gasUsed,
        gas_price: tx.gasPrice,
        sponsored_gas_wei: sponsoredGasWei.toString(),
        sponsored_gas_usd: sponsoredGasUsd,
        token_symbol: tx.tokenSymbol,
        receiver_address: tx.receiverAddress,
      },
      { onConflict: "tx_hash,chain_id", ignoreDuplicates: true },
    );

  if (txError) throw new Error(`recordSponsoredTransaction insert: ${txError.message}`);

  // Atomically increment the user's gas totals using a Postgres RPC.
  const { error: rpcError } = await supabase.rpc("increment_user_gas", {
    p_address: userAddress,
    p_gas_wei: sponsoredGasWei.toString(),
    p_gas_usd: sponsoredGasUsd,
  });

  if (rpcError) throw new Error(`recordSponsoredTransaction rpc: ${rpcError.message}`);
}
