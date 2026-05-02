import { SendForm } from "../../components/send/SendForm";
import { Layout } from "@/components/layout/layout";
import Link from "next/link";

export default function SendPage() {
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
            <h1 className="text-[28px] font-bold text-ink mt-1">Send</h1>
            <p className="text-ink-faint text-sm mt-1">Gas-free on all networks</p>
          </div>
          <SendForm />
        </div>
      </main>
    </Layout>
  );
}
