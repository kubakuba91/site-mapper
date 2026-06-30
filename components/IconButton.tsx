"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
};

export default function IconButton({ label, children, className = "", ...rest }: Props) {
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label={label} {...rest} className={className}>
        {children}
      </button>
      <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {label}
      </span>
    </span>
  );
}
