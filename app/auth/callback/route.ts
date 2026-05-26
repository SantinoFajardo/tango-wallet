import { supabase } from "@/db/supabase";
import { NextRequest } from "next/server";

// Handles the OAuth redirect from Supabase (Google login)
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  return Response.redirect(`${origin}/`);
}
