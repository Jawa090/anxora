import * as React from "react";
import { useState, useEffect } from "react";
import { ExternalLink, Globe } from "lucide-react";
import Cookies from "js-cookie";

interface LinkMetadata {
  title: string;
  description: string;
  image: string;
  siteName: string;
}

const linkCache = new Map<string, LinkMetadata>();

interface LinkPreviewCardProps {
  url: string;
}

export function LinkPreviewCard({ url }: LinkPreviewCardProps) {
  let hostname = "";
  let displayPath = "";
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.replace(/^www\./i, "");
    displayPath = parsed.pathname !== "/" ? parsed.pathname : "";
  } catch {
    return null;
  }

  const defaultTitle = displayPath
    ? displayPath
        .split("/")
        .filter(Boolean)
        .slice(-2)
        .map((s) => s.replace(/[-_]/g, " "))
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" - ") || hostname
    : hostname;

  const [metadata, setMetadata] = useState<LinkMetadata | null>(() => {
    return linkCache.get(url) || null;
  });
  const [loading, setLoading] = useState(!metadata);

  useEffect(() => {
    if (!url) return;
    if (linkCache.has(url)) {
      setMetadata(linkCache.get(url)!);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    const fetchPreview = async () => {
      try {
        const apiUrl = `${
          import.meta.env.VITE_API_URL || "http://localhost:3001/api"
        }/workgroups/link-preview?url=${encodeURIComponent(url)}`;
        const token = Cookies.get("token") || localStorage.getItem("token");

        const res = await fetch(apiUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) throw new Error("Preview fetch failed");
        const data = await res.json();

        if (data && data.success && !isCancelled) {
          const meta: LinkMetadata = {
            title: data.title || "",
            description: data.description || "",
            image: data.image || "",
            siteName: data.siteName || "",
          };
          linkCache.set(url, meta);
          setMetadata(meta);
        }
      } catch (err) {
        // Silently fallback to domain display
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchPreview();

    return () => {
      isCancelled = true;
    };
  }, [url]);

  const title = metadata?.title || defaultTitle;
  const domainUpper = (metadata?.siteName || hostname).toUpperCase();
  const displayUrl = `${hostname}${displayPath}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      onClick={handleClick}
      role="link"
      tabIndex={0}
      title={`Open ${url}`}
      className="w-full max-w-[420px] mb-2 rounded-2xl border border-primary/25 bg-black/10 dark:bg-black/35 backdrop-blur-xs hover:border-primary/45 transition-all cursor-pointer shadow-xs p-3 pr-8 flex items-center gap-3.5 group/link relative overflow-hidden select-none"
    >
      {/* Left Icon / Image Thumbnail */}
      <div className="h-12 w-12 rounded-2xl bg-primary/15 dark:bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 text-primary group-hover/link:bg-primary group-hover/link:text-primary-foreground transition-all overflow-hidden shadow-xs">
        {metadata?.image ? (
          <img
            src={metadata.image}
            alt={title}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        ) : (
          <ExternalLink className="h-5 w-5 stroke-[2.2]" />
        )}
      </div>

      {/* Center Details Column */}
      <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
        {/* Domain in Primary Brand Color + Inline Arrow */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary truncate leading-tight">
            {domainUpper}
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-primary shrink-0 stroke-[2.2]" />
        </div>

        {/* Title */}
        <p
          className={`text-[13px] font-bold text-foreground truncate leading-snug ${
            loading && !metadata ? "opacity-70 animate-pulse" : ""
          }`}
        >
          {title}
        </p>

        {/* URL / Subtitle */}
        <p className="text-[11px] text-muted-foreground truncate leading-tight">
          {displayUrl}
        </p>
      </div>
    </div>
  );
}
