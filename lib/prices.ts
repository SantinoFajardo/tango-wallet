// Maps native token symbols to CoinGecko coin IDs.
// Add an entry here when supporting a new chain whose native token isn't listed.
const COINGECKO_IDS: Record<string, string> = {
  ETH: "ethereum",
  MATIC: "matic-network",
  POL: "matic-network",
  BNB: "binancecoin",
  AVAX: "avalanche-2",
  OP: "optimism",
  ARB: "arbitrum",
  FTM: "fantom",
  CELO: "celo",
  GLMR: "moonbeam",
};

const priceCache = new Map<string, { usd: number; ts: number }>();
const CACHE_TTL = 60_000;

export async function getNativeTokenPriceUSD(symbol: string): Promise<number> {
  const id = COINGECKO_IDS[symbol.toUpperCase()];
  if (!id) return 0;

  const cached = priceCache.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.usd;

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const usd: number = data[id]?.usd ?? 0;
    priceCache.set(id, { usd, ts: Date.now() });
    return usd;
  } catch {
    return 0;
  }
}
