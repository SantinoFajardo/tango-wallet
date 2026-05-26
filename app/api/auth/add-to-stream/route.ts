import { getMoralis } from "@/db/moralis";

export async function POST(request: Request) {
  const streamId = process.env.MORALIS_STREAM_ID;
  if (!streamId) {
    // Stream not configured — skip silently so auth still succeeds
    return Response.json({ message: "ok", skipped: true });
  }

  let walletAddress: string;
  try {
    ({ walletAddress } = await request.json());
  } catch {
    return Response.json({ message: "Invalid body" }, { status: 400 });
  }

  if (!walletAddress) {
    return Response.json({ message: "walletAddress is required" }, { status: 400 });
  }

  try {
    const moralis = await getMoralis();
    await moralis.Streams.addAddress({ id: streamId, address: walletAddress });
    return Response.json({ message: "ok" });
  } catch (err) {
    console.error("[add-to-stream] Moralis error", err);
    return Response.json({ message: "Stream error" }, { status: 500 });
  }
}
