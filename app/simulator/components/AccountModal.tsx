"use client";

import { useEffect, useRef } from "react";
import { STRINGS } from "../data/strings";

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AccountModal({ open, onClose }: AccountModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-auto max-w-sm rounded-2xl border border-border bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="card-strong rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
          <svg className="h-8 w-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>

        <h3 className="mb-2 text-xl font-bold text-text-primary">
          {STRINGS.comingSoonTitle}
        </h3>
        <p className="mb-6 text-sm text-text-secondary leading-relaxed">
          {STRINGS.comingSoonBody}
        </p>

        <button
          onClick={onClose}
          className="w-full rounded-xl border-2 border-border px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-brand-500 hover:text-text-primary"
        >
          Stäng
        </button>
      </div>
    </dialog>
  );
}
