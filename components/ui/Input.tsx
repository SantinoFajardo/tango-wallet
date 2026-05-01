"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

type InputSize = "sm" | "md" | "lg";

const sizeClasses: Record<InputSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-4 py-3 text-sm",
};

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  inputSize?: InputSize;
  fullWidth?: boolean;
  suffix?: ReactNode;
}

export function Input({
  label,
  error,
  inputSize = "md",
  fullWidth = true,
  suffix,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={`space-y-1.5 ${fullWidth ? "w-full" : ""}`}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-ink-dim">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={[
            "rounded-xl border bg-layer text-ink placeholder:text-ink-faint",
            "focus:outline-none focus:ring-2 transition",
            error
              ? "border-err-ink focus:ring-err-ink"
              : "border-line focus:ring-brand",
            suffix ? "pr-14" : "",
            sizeClasses[inputSize],
            fullWidth ? "w-full" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-dim pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-err-ink">{error}</p>}
    </div>
  );
}
