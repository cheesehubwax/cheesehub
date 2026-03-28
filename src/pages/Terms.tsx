import { Layout } from "@/components/Layout";
import { TermsContent } from "@/components/shared/TermsContent";

export default function Terms() {
  return (
    <Layout>
      <div className="container max-w-3xl py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-cheese mb-2">Terms of Use</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 2025</p>
        </div>
        <TermsContent />
      </div>
    </Layout>
  );
}
