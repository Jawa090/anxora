import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="-10 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-current", className)}
    >
      <path
        d="M 32 32 C 32 24, 68 24, 68 32 C 68 40, 32 40, 32 50 C 32 60, 68 60, 68 70 C 68 80, 32 80, 32 70"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 32 32 L 68 32"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      <path
        d="M 32 50 L 58 50"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      <path
        d="M 32 70 L 68 70"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
