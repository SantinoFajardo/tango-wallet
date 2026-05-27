"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/db/supabase";

const NAV_ITEMS = [
  { id: "home",     label: "Home",     icon: "⌂", href: "/" },
  { id: "tokens",   label: "Tokens",   icon: "◎", href: "/tokens" },
  { id: "activity", label: "Activity", icon: "↕", href: "/activity" },
  { id: "send",     label: "Send",     icon: "⬆", href: "/send" },
  { id: "deposit",  label: "Deposit",  icon: "⬇", href: "/deposit" },
  { id: "swap",     label: "Swap",     icon: "⇄", href: "/swap" },
  { id: "settings", label: "Settings", icon: "⚙", href: "/settings" },
  { id: "profile",  label: "Profile",  icon: "◉", href: "/profile" },
];

interface SidebarProps {
  dark: boolean;
  setDark: (v: boolean) => void;
}

export default function Sidebar({ dark, setDark }: SidebarProps) {
  const pathname = usePathname();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user?.email) return;
      const { data } = await supabase
        .from("users")
        .select("wallet_address")
        .eq("email", session.user.email)
        .single();
      if (data?.wallet_address) setWalletAddress(data.wallet_address);
    });
  }, []);

  const truncate = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("tango_theme", next ? "dark" : "light");
  };

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "28px 0",
        boxShadow: "var(--shadow)",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "0 24px 32px" }}>
        <Link
          href="/"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background:
                "linear-gradient(135deg, var(--violet-500), var(--violet-700))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            T
          </div>
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-primary)",
                lineHeight: 1,
              }}
            >
              Tango
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Wallet
            </div>
          </div>
        </Link>
      </div>

      {/* Nav items */}
      <nav
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "0 12px",
        }}
      >
        {NAV_ITEMS.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.id}
              href={n.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 10,
                textDecoration: "none",
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>
                {n.icon}
              </span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div
        style={{
          padding: "16px 24px 0",
          borderTop: "1px solid var(--border)",
          marginTop: "auto",
        }}
      >
        <button
          onClick={toggleTheme}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-surface2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "8px 14px",
            cursor: "pointer",
            width: "100%",
            color: "var(--text-secondary)",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "inherit",
          }}
        >
          <span>{dark ? "☀️" : "🌙"}</span>
          {dark ? "Light mode" : "Dark mode"}
        </button>
      </div>

      {/* Wallet address */}
      <div style={{ padding: "12px 24px 0" }}>
        <div
          style={{
            background: "var(--bg-surface2)",
            borderRadius: 10,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, var(--violet-400), var(--violet-600))",
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 1,
              }}
            >
              Connected
            </div>
            <div
              style={{
                fontSize: 12,
                fontFamily: "var(--font-dm-mono), monospace",
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              {walletAddress ? truncate(walletAddress) : "0x···"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
