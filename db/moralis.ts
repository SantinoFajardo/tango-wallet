import Moralis from "moralis";

let initialized = false;

export async function getMoralis() {
  if (!initialized) {
    await Moralis.start({ apiKey: process.env.MORALIS_API_KEY! });
    initialized = true;
  }
  return Moralis;
}
