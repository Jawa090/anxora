import React from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  lightText?: boolean;
  subtitle?: string;
}

export function BrandLogo({
  className,
  iconOnly = false,
  size = "md",
  lightText = false,
  subtitle = "SMART",
}: BrandLogoProps) {
  const iconSizes = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
    xl: "h-14 w-14",
  };

  const titleSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
    xl: "text-2xl",
  };

  const subSizes = {
    sm: "text-[9px] tracking-[0.25em]",
    md: "text-[10px] tracking-[0.3em]",
    lg: "text-[11px] tracking-[0.35em]",
    xl: "text-[12px] tracking-[0.4em]",
  };

  return (
    <div className={cn("flex items-center gap-3 select-none", className)}>
      {/* Ribbon Logo Mark matching the image */}
      <div
        className={cn(
          "relative flex items-center justify-center shrink-0 rounded-xl bg-[#03292C] p-1.5 shadow-md border border-[#2DD4BF]/20 transition-transform duration-300 hover:scale-105",
          iconSizes[size]
        )}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full text-white"
        >
          {/* Continuous looped stylized "ES" ribbon mark from logo image */}
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
      </div>

      {!iconOnly && (
        <div className="flex flex-col justify-center leading-none">
          <span
            className={cn(
              "font-serif font-bold tracking-widest leading-none",
              titleSizes[size],
              lightText ? "text-white" : "text-foreground"
            )}
            style={{ fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif" }}
          >
            ANXORA
          </span>
          <span
            className={cn(
              "mt-1 uppercase font-semibold text-[#2DD4BF]",
              subSizes[size]
            )}
          >
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}
