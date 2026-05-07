import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "thirdweb/chains";
import type { Chain } from "thirdweb";

// Add or remove chains here — everything else derives from the chain object.
export const SUPPORTED_CHAINS: Chain[] = [
  baseSepolia,
  sepolia,
  mainnet,
  polygon,
  arbitrum,
  optimism,
  base,
];

export const DEFAULT_CHAIN: Chain = baseSepolia;
