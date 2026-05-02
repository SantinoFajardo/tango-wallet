"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getNativeTokenPriceUSD } from "@/lib/prices";

export interface SponsoredTxInput {
  txHash: string;
  chainId: number;
  chainNativeSymbol: string;
  gasUsed: string;
  gasPrice: string;
  tokenSymbol: string;
  contractAddress: string | null;
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

  const { error: txError } = await supabase.rpc("upsert_transaction", {
    p_tx_hash: tx.txHash,
    p_chain_id: tx.chainId,
    p_user_address: userAddress,
    p_from_address: userAddress,
    p_to_address: tx.receiverAddress,
    p_value_raw: "0",
    p_contract_address: tx.contractAddress,
    p_symbol: tx.tokenSymbol,
    p_token_name: tx.tokenSymbol,
    p_decimals: 18,
    p_direction: "out",
    p_block_number: "",
    p_block_timestamp: "",
    p_status: "PENDING",
    p_gas_used: tx.gasUsed,
    p_gas_price: tx.gasPrice,
    p_sponsored_gas_wei: sponsoredGasWei.toString(),
    p_sponsored_gas_usd: sponsoredGasUsd,
  });

  if (txError) throw new Error(`recordSponsoredTransaction insert: ${txError.message}`);

  const { error: rpcError } = await supabase.rpc("increment_user_gas", {
    p_address: userAddress,
    p_gas_wei: sponsoredGasWei.toString(),
    p_gas_usd: sponsoredGasUsd,
  });

  if (rpcError) throw new Error(`recordSponsoredTransaction rpc: ${rpcError.message}`);
}
