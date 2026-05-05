"use client";

import { wallets } from "@/components/home-client";
import { SUPPORTED_CHAINS, DEFAULT_CHAIN } from "@/lib/chains";
import { client } from "@/lib/client";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useActiveAccount, useConnectModal } from "thirdweb/react";

function UserNav() {
  const account = useActiveAccount();
  const { connect } = useConnectModal();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") setTheme("dark");
  }, []);

  if (!account) {
    return (
      <button
        onClick={() =>
          connect({
            client,
            wallets,
            chain: DEFAULT_CHAIN,
            chains: SUPPORTED_CHAINS,
            theme,
            title: "Sign in to Tango",
            titleIcon: "",
          })
        }
        className="text-sm font-semibold px-4 py-2 rounded-xl bg-brand text-brand-on hover:bg-brand-hi transition-colors"
      >
        Sign in
      </button>
    );
  }

  const abbr = account.address.slice(2, 4).toUpperCase();

  return (
    <Link href="/profile" title="View profile">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white transition-transform hover:scale-110 cursor-pointer"
        style={{ background: "linear-gradient(135deg, #7c3aed, #4c1d95)" }}
      >
        {abbr}
      </div>
    </Link>
  );
}

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-page">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-line bg-page/80 backdrop-blur sticky top-0 z-10">
        <Link href="/" className="flex flex-row items-center gap-2">
          <Image
            src="https://res.cloudinary.com/santino/image/upload/v1775853164/mate-icon_vqyjkp.webp"
            alt="Tango Wallet"
            width={40}
            height={40}
          />
          <span className="text-lg font-semibold tracking-tight text-ink">
            Tango Wallet
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserNav />
        </div>
      </nav>
      <div>{children}</div>
    </div>
  );
};
