import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mina sidor",
};

export default function MinaSidorPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-light text-brand-900">Mina sidor</h1>
      <p className="mt-4 text-text-secondary">Innehall kommer snart.</p>
    </div>
  );
}
