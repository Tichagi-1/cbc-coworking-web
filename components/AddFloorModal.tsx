"use client";

import { FormEvent, useState } from "react";

interface AddFloorModalProps {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (data: { number: number; name: string | null }) => void;
}

export default function AddFloorModal({
  open,
  submitting = false,
  onClose,
  onSubmit,
}: AddFloorModalProps) {
  const [number, setNumber] = useState("1");
  const [name, setName] = useState("");

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const n = parseInt(number, 10);
    if (Number.isNaN(n)) return;
    onSubmit({ number: n, name: name.trim() || null });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6 space-y-4"
      >
        <h3 className="text-lg font-semibold text-gray-900">Add floor</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Floor number
          </label>
          <input
            type="number"
            required
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Floor name <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ground Floor"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-cbc-blue hover:bg-cbc-bright-blue rounded-md disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Add floor"}
          </button>
        </div>
      </form>
    </div>
  );
}
