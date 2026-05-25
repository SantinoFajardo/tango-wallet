import type { IWebhook, IERC20Transfer, Transaction, InternalTransaction, INativeBalance } from "@moralisweb3/streams-typings";
import { getMoralis } from "@/db/moralis";
import { chains } from "@/db/models/chains";
import { tokens } from "@/db/models/tokens";
import { users } from "@/db/models/users";
import { balances } from "@/db/models/balances";
import { transactions } from "@/db/models/transactions";
import { TxStatus, type Chain, type Token } from "@/db/db.interfaces";

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") ?? "";

  const payload = JSON.parse(rawBody) as IWebhook;

  const moralis = await getMoralis();
  try {
    moralis.Streams.verifySignature({ body: payload, signature });
  } catch {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Skip unconfirmed — Moralis calls twice; we wait for the confirmed call
  if (!payload.confirmed) {
    return Response.json({ message: "ok" });
  }

  try {
    await processDeposits(payload);
  } catch (err) {
    console.error("[moralis-webhook] processDeposits failed", err);
    return Response.json({ message: "Internal error" }, { status: 500 });
  }

  return Response.json({ message: "ok" });
}

// ─── Core processor ──────────────────────────────────────────────────────────

async function processDeposits(payload: IWebhook) {
  const chainNumber = parseInt(payload.chainId, 16);
  const blockNumber = parseInt(payload.block.number, 10);

  const chain = await chains.getByChainNumber(chainNumber);
  if (!chain) return;

  const candidateAddresses = collectRecipients(payload);
  if (candidateAddresses.size === 0) return;

  const walletToUser = await users.getManyByWalletAddress([...candidateAddresses]);
  if (walletToUser.size === 0) return;

  await Promise.all([
    handleErc20Transfers(payload.erc20Transfers, walletToUser, chain, blockNumber),
    handleNativeTransfers(payload.txs, payload.txsInternal, payload.nativeBalances, walletToUser, chain, blockNumber),
  ]);
}

// ─── ERC20 handler ────────────────────────────────────────────────────────────

async function handleErc20Transfers(
  transfers: IERC20Transfer[],
  walletToUser: Map<string, { id: string }>,
  chain: Chain,
  blockNumber: number
) {
  const incoming = transfers.filter((t) => walletToUser.has(t.to.toLowerCase()));
  if (incoming.length === 0) return;

  const contractAddresses = [...new Set(incoming.map((t) => t.contract.toLowerCase()))];
  const tokenMap = await tokens.getByContracts(chain.id, contractAddresses);

  await Promise.all(
    incoming.map(async (transfer) => {
      const user = walletToUser.get(transfer.to.toLowerCase())!;
      const token = tokenMap.get(transfer.contract.toLowerCase());
      if (!token) return;

      await Promise.all([
        balances.increment(user.id, token.id, transfer.value, parseInt(transfer.tokenDecimals)),
        transactions.upsertByHash({
          user_id: user.id,
          token_id: token.id,
          chain_id: chain.id,
          tx_hash: transfer.transactionHash,
          from_address: transfer.from,
          to_address: transfer.to,
          amount_in_wei: transfer.value,
          status: TxStatus.CONFIRMED,
          block_number: blockNumber,
        }),
      ]);
    })
  );
}

// ─── Native handler ───────────────────────────────────────────────────────────

async function handleNativeTransfers(
  txs: Transaction[],
  txsInternal: InternalTransaction[],
  nativeBalancesList: INativeBalance[],
  walletToUser: Map<string, { id: string }>,
  chain: Chain,
  blockNumber: number
) {
  const nativeToken = await tokens.getNativeByChain(chain.id);
  if (!nativeToken) return;

  const incomingTxs = txs.filter(
    (tx) => tx.toAddress && tx.value && tx.value !== "0" && walletToUser.has(tx.toAddress.toLowerCase())
  );

  const incomingInternal = txsInternal.filter(
    (itx) => itx.to && itx.value && itx.value !== "0" && walletToUser.has(itx.to.toLowerCase())
  );

  await Promise.all([
    ...incomingTxs.map((tx) => handleNativeTx(tx, walletToUser, chain, nativeToken, blockNumber)),
    ...incomingInternal.map((itx) => handleInternalTx(itx, walletToUser, chain, nativeToken, blockNumber)),
    // nativeBalances is the authoritative on-chain balance — set it directly
    ...nativeBalancesList
      .filter((nb) => walletToUser.has(nb.address.toLowerCase()))
      .map((nb) => {
        const user = walletToUser.get(nb.address.toLowerCase())!;
        return balances.set(user.id, nativeToken.id, nb.balance, nativeToken.decimals);
      }),
  ]);
}

async function handleNativeTx(
  tx: Transaction,
  walletToUser: Map<string, { id: string }>,
  chain: Chain,
  nativeToken: Token,
  blockNumber: number
) {
  const user = walletToUser.get(tx.toAddress!.toLowerCase())!;
  await Promise.all([
    balances.increment(user.id, nativeToken.id, tx.value!, nativeToken.decimals),
    transactions.upsertByHash({
      user_id: user.id,
      token_id: nativeToken.id,
      chain_id: chain.id,
      tx_hash: tx.hash,
      from_address: tx.fromAddress,
      to_address: tx.toAddress!,
      amount_in_wei: tx.value!,
      status: TxStatus.CONFIRMED,
      block_number: blockNumber,
      gas_used: tx.receiptGasUsed ?? undefined,
    }),
  ]);
}

async function handleInternalTx(
  itx: InternalTransaction,
  walletToUser: Map<string, { id: string }>,
  chain: Chain,
  nativeToken: Token,
  blockNumber: number
) {
  const user = walletToUser.get(itx.to!.toLowerCase())!;
  await Promise.all([
    balances.increment(user.id, nativeToken.id, itx.value!, nativeToken.decimals),
    transactions.upsertByHash({
      user_id: user.id,
      token_id: nativeToken.id,
      chain_id: chain.id,
      tx_hash: itx.transactionHash,
      from_address: itx.from ?? "",
      to_address: itx.to!,
      amount_in_wei: itx.value!,
      status: TxStatus.CONFIRMED,
      block_number: blockNumber,
    }),
  ]);
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function collectRecipients(payload: IWebhook): Set<string> {
  const addresses = new Set<string>();
  for (const t of payload.erc20Transfers) addresses.add(t.to.toLowerCase());
  for (const tx of payload.txs) if (tx.toAddress) addresses.add(tx.toAddress.toLowerCase());
  for (const itx of payload.txsInternal) if (itx.to) addresses.add(itx.to.toLowerCase());
  for (const nb of payload.nativeBalances) addresses.add(nb.address.toLowerCase());
  return addresses;
}
