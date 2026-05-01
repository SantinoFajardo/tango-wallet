import { SendForm } from "../../components/send/SendForm";
import { Layout } from "@/components/layout/layout";

export default function SendPage() {
  return (
    <Layout>
      <main className="min-h-screen bg-zinc-950 px-4 py-12">
        <div className="max-w-lg mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-50">Send</h1>
            <p className="text-zinc-500 text-sm mt-1">Gas is sponsored — you pay nothing.</p>
          </div>
          <SendForm />
        </div>
      </main>
    </Layout>
  );
}
