"use client";

const themeScript = `(function(){try{var s=localStorage.getItem('theme');if(s==='light'){document.documentElement.classList.remove('dark')}else if(!s&&!window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.remove('dark')}}catch(e){}})()`;

import { ThirdwebProvider } from "thirdweb/react";
import Script from "next/script";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ThirdwebProvider>
    <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
    {children}
  </ThirdwebProvider>;
}
