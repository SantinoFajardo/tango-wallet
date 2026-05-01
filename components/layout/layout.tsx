import { wallets } from '@/app/home-client';
import { SUPPORTED_CHAINS } from '@/lib/chains';
import { client } from '@/lib/client';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react'
import { ConnectButton } from 'thirdweb/react';

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
                    <ConnectButton
                        client={client}
                        wallets={wallets}
                        chains={SUPPORTED_CHAINS}
                        connectModal={{
                            title: "Sign in to Tango",
                            titleIcon: "",
                        }}
                    />
                </div>
            </nav>
            <div className="">
                {children}
            </div>
        </div>
    );
};