-- Add is_stable column to tokens table.
-- Run this in Supabase → SQL Editor.

ALTER TABLE tokens ADD COLUMN IF NOT EXISTS is_stable BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE tokens SET is_stable = TRUE WHERE id IN (
  -- USDC
  'e7238cc7-5580-46cc-a787-5d0fa074dde3', -- USDC Ethereum
  'a288ee3c-9460-4e1e-981b-b4f15c0fb7de', -- USDC Optimism
  'da6dd184-a509-4c9f-a028-e51ac93d379d', -- USDC Polygon
  'cbd379e9-b926-4bbd-8124-cfddc159cf4f', -- USDC Base
  '569dc581-6cf8-45f9-94ed-9818e2650ddc', -- USDC Arbitrum
  '9e9bf786-bd9e-433c-a1e7-54135085c938', -- USDC Base Sepolia
  '1e9b913d-f20e-419a-8703-d974be7b1d4c', -- USDC Sepolia
  -- USDT
  '94e261c1-2cb3-4bdb-8baa-3ba368ce139c', -- USDT Ethereum
  'ac8c412f-baeb-4162-8320-860685dfc27b', -- USDT Optimism
  'cd577ae3-8ead-43c8-88c9-e6963cebde18', -- USDT Polygon
  '8d836a97-ad88-4a42-a6c6-fda453e38471', -- USDT Arbitrum
  -- DAI
  '4464adba-8d41-4a86-b7c6-9d0600f91ee5', -- DAI Ethereum
  'b9d3b526-65a7-472a-b994-2e0248c2bbe5', -- DAI Optimism
  'da0a7d06-e569-47fc-a9ae-6cb3efd82c9d', -- DAI Polygon
  '72b43fdb-5e25-4db0-b53a-893202168093', -- DAI Base
  '5a65dd99-6fa2-4cdf-95b3-3f3f630e6e64'  -- DAI Arbitrum
);
