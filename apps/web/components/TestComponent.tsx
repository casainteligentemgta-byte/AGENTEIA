"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type TestComponentVariant = "primary" | "outline" | "ghost";

type TestComponentProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: TestComponentVariant;
  children: React.ReactNode;
};

const variantStyles: Record<TestComponentVariant, string> = {
  primary:
    "border-emerald-500/50 bg-emerald-500/10 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.08)] hover:bg-emerald-500/20 hover:border-emerald-500/70 hover:shadow-[0_0_24px_rgba(16,185,129,0.12)] active:bg-emerald-500/25",
  outline:
    "border-neutral-600 bg-transparent text-neutral-200 hover:bg-neutral-800/80 hover:border-neutral-500 active:bg-neutral-800",
  ghost:
    "border-transparent bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700/80 hover:text-neutral-100 active:bg-neutral-700",
};

export const TestComponent = forwardRef<HTMLButtonElement, TestComponentProps>(
  ({ variant = "primary", className = "", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={`
          inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-2.5
          text-sm font-medium transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-neutral-950
          disabled:pointer-events-none disabled:opacity-50
          ${variantStyles[variant]}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }
);

TestComponent.displayName = "TestComponent";
