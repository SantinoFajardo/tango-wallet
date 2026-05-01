import { baseSepolia, sepolia } from "thirdweb/chains";
import type { Chain } from "thirdweb";

// Add or remove chains here — everything else derives from the chain object.
export const SUPPORTED_CHAINS: Chain[] = [baseSepolia, sepolia];

export const DEFAULT_CHAIN: Chain = baseSepolia;
