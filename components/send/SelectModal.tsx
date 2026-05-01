"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface SelectItem {
  id: string;
  name: string;
  symbol?: string;
  image_url?: string;
}

interface SelectModalProps<T extends SelectItem> {
  items: T[];
  selected: T | null;
  onSelect: (item: T) => void;
  label: string;
  placeholder: string;
  loading?: boolean;
  disabled?: boolean;
}

export function SelectModal<T extends SelectItem>({
  items,
  selected,
  onSelect,
  label,
  placeholder,
  loading,
  disabled,
}: SelectModalProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.symbol?.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-400">{label}</label>

      {loading ? (
        <div className="h-12 rounded-xl bg-zinc-800 animate-pulse" />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-left transition-colors hover:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selected ? (
            <>
              {selected.image_url && (
                <Image
                  src={selected.image_url}
                  alt={selected.name}
                  width={24}
                  height={24}
                  className="rounded-full shrink-0"
                />
              )}
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-zinc-50 truncate">
                  {selected.symbol ?? selected.name}
                </span>
                {selected.symbol && (
                  <span className="block text-xs text-zinc-500 truncate">
                    {selected.name}
                  </span>
                )}
              </span>
              <span className="text-zinc-500 text-xs shrink-0">▾</span>
            </>
          ) : (
            <span className="text-zinc-500 flex-1">{placeholder}</span>
          )}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-4 pb-3 border-b border-zinc-800">
              <p className="text-sm font-semibold text-zinc-200 mb-3">{label}</p>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
              />
            </div>

            <ul className="max-h-72 overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <li className="px-4 py-6 text-center text-zinc-500 text-sm">
                  No results
                </li>
              ) : (
                filtered.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(item);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-zinc-800 ${
                        selected?.id === item.id
                          ? "bg-violet-950/40 text-zinc-50"
                          : "text-zinc-300"
                      }`}
                    >
                      {item.image_url && (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          width={32}
                          height={32}
                          className="rounded-full shrink-0"
                        />
                      )}
                      <span className="flex-1 min-w-0 text-left">
                        <span className="block font-medium truncate">
                          {item.symbol ?? item.name}
                        </span>
                        {item.symbol && (
                          <span className="block text-xs text-zinc-500 truncate">
                            {item.name}
                          </span>
                        )}
                      </span>
                      {selected?.id === item.id && (
                        <span className="text-violet-400 text-xs shrink-0">✓</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
