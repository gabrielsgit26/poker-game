"use client";

import { useEffect, useState } from "react";

export type UserAvatarProps = {
  /** HTTPS URL from Telegram WebApp `user.photo_url` (or persisted copy). */
  photoUrl?: string | null;
  /** Shown when there is no URL or the image fails to load. */
  fallbackEmoji?: string;
  /** Visually hidden label for accessibility (e.g. display name). */
  label: string;
  className?: string;
};

/**
 * Rounds Telegram profile photos (or any HTTPS URL) with a stable emoji fallback.
 */
export function UserAvatar({
  photoUrl,
  fallbackEmoji = "♠",
  label,
  className,
}: UserAvatarProps) {
  const [broken, setBroken] = useState(false);

  const trimmed = typeof photoUrl === "string" ? photoUrl.trim() : "";
  const safe =
    trimmed.length > 0 &&
    trimmed.startsWith("https://") &&
    !broken;

  useEffect(() => {
    setBroken(false);
  }, [trimmed]);

  return (
    <div
      className={className}
      title={label}
    >
      {safe ? (
        <img
          src={trimmed}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center" aria-hidden>
          {fallbackEmoji}
        </span>
      )}
      {label.trim().length > 0 ? (
        <span className="sr-only">{label}</span>
      ) : null}
    </div>
  );
}
