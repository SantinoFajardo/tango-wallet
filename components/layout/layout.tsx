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

  return (
    <Link href="/profile" title="View profile">
      <div className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer bg-violet-100 dark:bg-violet-900/30">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5 text-violet-600 dark:text-violet-400"
        >
          <path
            fillRule="evenodd"
            d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
            clipRule="evenodd"
          />
        </svg>
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
