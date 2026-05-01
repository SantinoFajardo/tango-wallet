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
      <label className="text-xs font-medium text-ink-dim">{label}</label>

      {loading ? (
        <div className="h-12 rounded-xl bg-layer animate-pulse" />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-line bg-layer px-4 py-3 text-sm text-left transition-colors hover:border-line-hi disabled:opacity-50 disabled:cursor-not-allowed"
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
                <span className="block font-medium text-ink truncate">
                  {selected.symbol ?? selected.name}
                </span>
                {selected.symbol && (
                  <span className="block text-xs text-ink-faint truncate">
                    {selected.name}
                  </span>
                )}
              </span>
              <span className="text-ink-faint text-xs shrink-0">▾</span>
            </>
          ) : (
            <span className="text-ink-faint flex-1">{placeholder}</span>
          )}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-surface shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-4 pb-3 border-b border-line">
              <p className="text-sm font-semibold text-ink mb-3">{label}</p>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-xl border border-line bg-layer px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand transition"
              />
            </div>

            <ul className="max-h-72 overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <li className="px-4 py-6 text-center text-ink-faint text-sm">
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
                      className={`flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-layer ${
                        selected?.id === item.id
                          ? "bg-tint text-ink"
                          : "text-ink-dim"
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
                          <span className="block text-xs text-ink-faint truncate">
                            {item.name}
                          </span>
                        )}
                      </span>
                      {selected?.id === item.id && (
                        <span className="text-tint-ink text-xs shrink-0">✓</span>
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
