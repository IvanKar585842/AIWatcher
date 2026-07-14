"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Globe2 } from "lucide-react";
import { cn, getFaviconUrl } from "@/lib/utils";

type WebsiteLogoProps = {
  url: string;
  faviconUrl?: string | null;
  alt?: string;
  size?: number;
  className?: string;
  imgClassName?: string;
};

function isGoogleFaviconHost(src: string): boolean {
  try {
    const host = new URL(src).hostname;
    return host === "www.google.com" || host === "google.com";
  } catch {
    return false;
  }
}

function safeImageSrc(src: string | null | undefined, fallback: string): string {
  if (!src?.trim()) return fallback;
  try {
    const parsed = new URL(src.trim());
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

/**
 * Optimized website logo with broken-image fallback chain:
 * stored favicon → Google s2 → generic globe icon.
 * Fixed box size prevents layout shift.
 */
export function WebsiteLogo({
  url,
  faviconUrl,
  alt = "",
  size = 24,
  className,
  imgClassName,
}: WebsiteLogoProps) {
  const google = getFaviconUrl(url, Math.max(size * 2, 64));
  const preferred = safeImageSrc(faviconUrl, google);
  const [src, setSrc] = useState(preferred);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(safeImageSrc(faviconUrl, google));
    setFailed(false);
  }, [faviconUrl, google]);

  const boxStyle = { width: size, height: size };

  if (failed) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-cyan-500/70",
          className
        )}
        style={boxStyle}
        aria-hidden={alt ? undefined : true}
      >
        <Globe2 style={{ width: size * 0.55, height: size * 0.55 }} />
      </span>
    );
  }

  const onError = () => {
    if (src !== google) {
      setSrc(google);
      return;
    }
    setFailed(true);
  };

  // Google host is in next.config remotePatterns — use next/image.
  // Arbitrary site icons use lazy <img> to avoid remotePatterns sprawl.
  if (isGoogleFaviconHost(src)) {
    return (
      <span
        className={cn("relative inline-flex shrink-0 overflow-hidden rounded-md", className)}
        style={boxStyle}
      >
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className={cn("h-full w-full object-contain", imgClassName)}
          unoptimized
          onError={onError}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-md bg-white/[0.03]",
        className
      )}
      style={boxStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary third-party favicon hosts */}
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn("h-full w-full object-contain", imgClassName)}
        onError={onError}
      />
    </span>
  );
}
