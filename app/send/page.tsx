import { SendForm } from "../../components/send/SendForm";
import { Layout } from "@/components/layout/layout";

export default function SendPage() {
  return (
    <Layout>
      <main className="min-h-screen bg-page px-4 py-12">
        <div className="max-w-lg mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-ink">Send</h1>
            <p className="text-ink-faint text-sm mt-1">Gas is sponsored — you pay nothing.</p>
          </div>
          <SendForm />
        </div>
      </main>
    </Layout>
  );
}
