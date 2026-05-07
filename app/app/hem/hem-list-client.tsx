// File: app/app/hem/hem-list-client.tsx
// NEW FILE.

"use client";

import { useState } from "react";
import Link from "next/link";
import { CreateHomeModal } from "./create-home-modal";

export interface HemListItem {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  property_count: number;
  my_role: "owner" | "member" | "read_only";
}

interface HemListClientProps {
  homes: HemListItem[];
}

export function HemListClient({ homes }: HemListClientProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Mina hem</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
        >
          + Skapa nytt hem
        </button>
      </div>

      {homes.length === 0 ? (
        <EmptyState onCreate={() => setModalOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {homes.map((home) => (
            <HomeCard key={home.id} home={home} />
          ))}
        </div>
      )}

      <CreateHomeModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

function HomeCard({ home }: { home: HemListItem }) {
  const created = new Date(home.created_at).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Link
      href={`/app/hem/${home.id}`}
      className="block rounded-lg border bg-white p-4 transition hover:border-blue-500"
    >
      <p className="text-base font-medium">
        {home.name}
        {home.my_role !== "owner" && (
          <span className="ml-2 text-xs font-normal text-gray-500">
            ({home.my_role === "member" ? "medlem" : "läs-rätt"})
          </span>
        )}
      </p>
      <p className="mt-1 text-sm text-gray-600">
        {home.property_count}{" "}
        {home.property_count === 1 ? "fastighet" : "fastigheter"}
      </p>
      <p className="mt-2 text-xs text-gray-400">Skapat {created}</p>
    </Link>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed bg-gray-50 p-12 text-center">
      <p className="mb-4 text-gray-600">
        Du har inte skapat några hem än. Skapa ditt första hem för att komma
        igång.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
      >
        + Skapa ditt första hem
      </button>
    </div>
  );
}
