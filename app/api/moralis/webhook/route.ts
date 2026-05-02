import { updateOrCreateTokenUserBalances, type WebhookPayload } from "@/components/dashboard/actions/balances";
import { NextRequest, NextResponse } from "next/server";

interface MoralisWebhookBody {
    abi: unknown[];
    block: {
        number: string;
        hash: string;
        timestamp: string;
    };
    chainId: string;
    confirmed: boolean;
    retries: number;
    tag: string;
    streamId: string;
    txs: {
        hash: string;
        gas: string;
        gasPrice: string;
        nonce: string;
        input: string;
        transactionIndex: string;
        fromAddress: string;
        toAddress: string;
        value: string;
        type: string;
        v: string;
        r: string;
        s: string;
        receiptCumulativeGasUsed: string;
        receiptGasUsed: string;
    }[];
    txsInternal: {
        from: string;
        to: string;
        value: string;
        transactionHash: string;
        gas: string;
    }[];
    logs: {
        logIndex: string;
        transactionHash: string;
        address: string;
        data: string;
        topic0: string;
        topic1: string | null;
        topic2: string | null;
        topic3: string | null;
    }[];
    erc20Transfers: {
        transactionHash: string;
        logIndex: string;
        contract: string;
        from: string;
        to: string;
        value: string;
        tokenName: string;
        tokenSymbol: string;
        tokenDecimals: string;
        valueWithDecimals: string;
        possibleSpam: boolean;
    }[];
    erc20Approvals: unknown[];
    nftTransfers: unknown[];
    nativeBalances: {
        address: string;
        balance: string;
        balanceFormatted: string;
    }[];
    nftTokenApprovals: unknown[];
}

export async function POST(req: NextRequest) {
    const body = await req.json() as MoralisWebhookBody;
    console.log("[moralis webhook]", body);

    // Only process confirmed blocks to avoid acting on re-orged transactions.
    if (!body.confirmed) {
        return NextResponse.json({ ok: true }, { status: 200 });
    }

    const payload: WebhookPayload = {
        chainId: body.chainId,
        block: body.block,
        txsInternal: body.txsInternal,
        erc20Transfers: body.erc20Transfers,
        nativeBalances: body.nativeBalances,
    };

    await updateOrCreateTokenUserBalances(payload);

    return NextResponse.json({ ok: true }, { status: 200 });
}
