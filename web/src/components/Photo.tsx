"use client";
import Image from "next/image";
import { useState } from "react";
import type { Photo as PhotoT } from "@/lib/images";

/** Responsive, lazy Unsplash photo with a neutral fallback if the CDN fails. */
export function Photo({ photo, sizes, priority = false, className = "" }: { photo: PhotoT; sizes: string; priority?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return <div role="img" aria-label={photo.alt} className={`bg-gradient-to-br from-teal-900 via-slate-900 to-slate-950 ${className}`} />;
  return (
    <Image
      src={photo.src}
      alt={photo.alt}
      fill
      sizes={sizes}
      priority={priority}
      quality={70}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

export function PhotoCredit({ photo }: { photo: PhotoT }) {
  return (
    <p className="text-[11px] text-white/80">
      Photo: <a className="underline" href={photo.page} rel="noopener noreferrer" target="_blank">{photo.photographer}</a> on Unsplash · {photo.location}
    </p>
  );
}
