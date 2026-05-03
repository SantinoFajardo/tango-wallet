import { ReceiveForm } from "@/components/receive/ReceiveForm";
import { Layout } from "@/components/layout/layout";
import Link from "next/link";

export default function ReceivePage() {
  return (
    <Layout>
      <main className="min-h-screen bg-page px-4 py-12">
        <div className="max-w-lg mx-auto space-y-8">
          <div>
            <Link
              href="/"
              className="text-ink-faint text-sm font-medium hover:text-ink transition-colors"
            >
              ← Portfolio
            </Link>
            <h1 className="text-[28px] font-bold text-ink mt-1">Deposit</h1>
            <p className="text-ink-faint text-sm mt-1">Receive tokens to your Tango wallet</p>
          </div>
          <ReceiveForm />
        </div>
      </main>
    </Layout>
  );
}
