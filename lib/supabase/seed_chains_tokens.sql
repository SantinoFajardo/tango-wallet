-- Seed chains and tokens for ThirdWeb Bridge swap support.
-- Includes both testnet (Base Sepolia, Sepolia) and mainnet chains.
-- Run this in Supabase → SQL Editor.

-- ─── Chains ───────────────────────────────────────────────────────────────────
INSERT INTO chains (name, chain_id, image_url, explorer_url) VALUES
  -- Testnets
  ('Base Sepolia',  84532,    'https://assets.coingecko.com/coins/images/35492/small/base.png',      'https://sepolia.basescan.org'),
  ('Sepolia',       11155111, 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',    'https://sepolia.etherscan.io'),
  -- Mainnet
  ('Ethereum',      1,        'https://assets.coingecko.com/coins/images/279/small/ethereum.png',    'https://etherscan.io'),
  ('Base',          8453,     'https://assets.coingecko.com/coins/images/35492/small/base.png',      'https://basescan.org'),
  ('Polygon',       137,      'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png', 'https://polygonscan.com'),
  ('Arbitrum One',  42161,    'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg', 'https://arbiscan.io'),
  ('Optimism',      10,       'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',  'https://optimistic.etherscan.io')
ON CONFLICT (chain_id) DO UPDATE SET
  name         = EXCLUDED.name,
  image_url    = EXCLUDED.image_url,
  explorer_url = EXCLUDED.explorer_url;

-- ─── Tokens ───────────────────────────────────────────────────────────────────

-- Ethereum (1)
INSERT INTO tokens (name, symbol, chain_id, contract_address, image_url, decimals, is_native) VALUES
  ('Ether',            'ETH',  1, NULL,                                         'https://assets.coingecko.com/coins/images/279/small/ethereum.png', 18, true),
  ('USD Coin',         'USDC', 1, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',     6,  false),
  ('Tether USD',       'USDT', 1, '0xdac17f958d2ee523a2206206994597c13d831ec7', 'https://assets.coingecko.com/coins/images/325/small/Tether.png',    6,  false),
  ('Wrapped Bitcoin',  'WBTC', 1, '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png', 8, false),
  ('Dai Stablecoin',   'DAI',  1, '0x6b175474e89094c44da98b954eedeac495271d0f', 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png', 18, false)
ON CONFLICT DO NOTHING;

-- Base (8453)
INSERT INTO tokens (name, symbol, chain_id, contract_address, image_url, decimals, is_native) VALUES
  ('Ether',            'ETH',  8453, NULL,                                         'https://assets.coingecko.com/coins/images/279/small/ethereum.png', 18, true),
  ('USD Coin',         'USDC', 8453, '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',     6,  false),
  ('Dai Stablecoin',   'DAI',  8453, '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png', 18, false),
  ('Wrapped Ether',    'WETH', 8453, '0x4200000000000000000000000000000000000006', 'https://assets.coingecko.com/coins/images/2518/small/weth.png',     18, false)
ON CONFLICT DO NOTHING;

-- Polygon (137)
INSERT INTO tokens (name, symbol, chain_id, contract_address, image_url, decimals, is_native) VALUES
  ('Matic',            'MATIC', 137, NULL,                                         'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png', 18, true),
  ('USD Coin',         'USDC',  137, '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',     6,  false),
  ('Tether USD',       'USDT',  137, '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', 'https://assets.coingecko.com/coins/images/325/small/Tether.png',    6,  false),
  ('Dai Stablecoin',   'DAI',   137, '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png', 18, false),
  ('Wrapped Ether',    'WETH',  137, '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', 'https://assets.coingecko.com/coins/images/2518/small/weth.png',     18, false)
ON CONFLICT DO NOTHING;

-- Arbitrum One (42161)
INSERT INTO tokens (name, symbol, chain_id, contract_address, image_url, decimals, is_native) VALUES
  ('Ether',            'ETH',  42161, NULL,                                         'https://assets.coingecko.com/coins/images/279/small/ethereum.png', 18, true),
  ('USD Coin',         'USDC', 42161, '0xaf88d065e77c8cc2239327c5edb3a432268e5831', 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',     6,  false),
  ('Tether USD',       'USDT', 42161, '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', 'https://assets.coingecko.com/coins/images/325/small/Tether.png',    6,  false),
  ('Dai Stablecoin',   'DAI',  42161, '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png', 18, false),
  ('Wrapped Bitcoin',  'WBTC', 42161, '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f', 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png', 8, false)
ON CONFLICT DO NOTHING;

-- Optimism (10)
INSERT INTO tokens (name, symbol, chain_id, contract_address, image_url, decimals, is_native) VALUES
  ('Ether',            'ETH',  10, NULL,                                         'https://assets.coingecko.com/coins/images/279/small/ethereum.png', 18, true),
  ('USD Coin',         'USDC', 10, '0x0b2c639c533813f4aa9d7837caf62653d097ff85', 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',     6,  false),
  ('Tether USD',       'USDT', 10, '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', 'https://assets.coingecko.com/coins/images/325/small/Tether.png',    6,  false),
  ('Dai Stablecoin',   'DAI',  10, '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png', 18, false),
  ('Wrapped Ether',    'WETH', 10, '0x4200000000000000000000000000000000000006', 'https://assets.coingecko.com/coins/images/2518/small/weth.png',     18, false)
ON CONFLICT DO NOTHING;
