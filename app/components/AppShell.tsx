"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname.startsWith("/auth");

  const [dark, setDark] = useState(true);

  // Read persisted preference; default to dark
  useEffect(() => {
    const stored = localStorage.getItem("tango_theme");
    setDark(stored ? stored === "dark" : true);
  }, []);

  // Apply theme class to body
  useEffect(() => {
    document.body.classList.toggle("dark", dark);
    document.body.classList.toggle("light", !dark);
  }, [dark]);

  if (isAuthRoute) return <>{children}</>;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg)",
      }}
    >
      <Sidebar dark={dark} setDark={setDark} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <TopNav />
        <main style={{ flex: 1, overflowY: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
