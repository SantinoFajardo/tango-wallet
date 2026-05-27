"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/db/supabase";

const ROUTE_TITLES: Record<string, string> = {
  "/":         "Home",
  "/tokens":   "Tokens",
  "/activity": "Activity",
  "/send":     "Send",
  "/deposit":  "Deposit",
  "/swap":     "Swap",
  "/settings": "Settings",
  "/profile":  "Profile",
};

export default function TopNav() {
  const pathname = usePathname();
  const [initial, setInitial] = useState("T");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const name =
        session?.user?.user_metadata?.full_name ??
        session?.user?.user_metadata?.name ??
        session?.user?.email ??
        null;
      if (name) setInitial(name[0].toUpperCase());
    });
  }, []);

  const title = ROUTE_TITLES[pathname] ?? "Tango Wallet";

  return (
    <div
      style={{
        height: 52,
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 28px",
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: "var(--shadow)",
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          fontWeight: 500,
        }}
      >
        {title}
      </span>

      <div style={{ flex: 1 }} />

      {/* Connected badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 99,
          background: "oklch(68% 0.20 155 / 0.1)",
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--green-accent)",
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--green-accent)",
          }}
        >
          Connected
        </span>
      </div>

      {/* User avatar */}
      <Link
        href="/profile"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          flexShrink: 0,
          background:
            "linear-gradient(135deg, var(--violet-400), var(--violet-600))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          textDecoration: "none",
          border: "2px solid var(--border)",
        }}
      >
        {initial}
      </Link>
    </div>
  );
}
