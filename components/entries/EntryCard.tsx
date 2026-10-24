import Link from "next/link";
import { Lock, Play } from "lucide-react";
import type { EntryCardData } from "@/lib/entries-view";
import { formatDayLabel, formatTime } from "@/lib/dates";
import { ENTRY_TYPE_LABEL } from "@/lib/constants";
import { excerpt } from "@/lib/format";

export function EntryCard({
  entry,
  timezone,
  compact = false,
}: {
  entry: EntryCardData;
  timezone: string;
  compact?: boolean;
}) {
  const timeLabel = formatTime(entry.occurredAt, timezone);
  const dayLabel = formatDayLabel(entry.occurredAt, timezone);
  const hasMedia = entry.media.length > 0;
  const typeLabel = ENTRY_TYPE_LABEL[entry.entryType] || "记录";

  return (
    <article className="card group overflow-hidden transition hover:border-line-strong">
      <Link href={`/entries/${entry.id}`} className="block">
        {hasMedia ? (
          <div className={`grid gap-0.5 ${entry.media.length === 1 ? "" : "grid-cols-2"}`}>
            {entry.media.slice(0, 4).map((media, index) => {
              const isWide = entry.media.length === 3 && index === 0;
              return (
                <div
                  key={media.id}
                  className={`relative overflow-hidden bg-raised ${
                    entry.media.length === 1
                      ? compact
                        ? "aspect-[16/10]"
                        : "aspect-[4/3]"
                      : isWide
                        ? "col-span-2 aspect-[2/1]"
                        : "aspect-square"
                  }`}
                >
                  {media.thumbUrl ? (
                    <img
                      src={media.thumbUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.015]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-faint">
                      <Play size={22} />
                    </div>
                  )}
                  {media.mediaType === "VIDEO" ? (
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                      <Play size={9} fill="currentColor" /> 视频
                    </span>
                  ) : null}
                  {index === 3 && entry.media.length > 4 ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[15px] font-semibold text-white">
                      +{entry.media.length - 4}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2 text-[10.5px] font-medium tracking-[0.08em] text-faint uppercase">
            <span>{dayLabel}</span>
            <span className="h-px w-3 bg-line-strong" />
            <span>{timeLabel}</span>
            <span className="ml-auto inline-flex items-center gap-1 normal-case tracking-normal">
              {entry.visibility === "PRIVATE" ? <Lock size={10.5} /> : null}
              {entry.isDemo ? (
                <span className="rounded-full bg-raised px-1.5 py-0.5 text-[9.5px] text-muted">示例</span>
              ) : null}
              <span className="text-faint">{typeLabel}</span>
            </span>
          </div>

          {entry.title ? (
            <h3 className="font-display mt-2 text-[24px] leading-[1.22] tracking-tight sm:text-[26px]">
              {entry.title}
            </h3>
          ) : null}

          {entry.body ? (
            <p
              className={`mt-1.5 text-[13.5px] leading-[1.7] text-muted ${
                entry.title ? "clamp-2" : "clamp-3"
              }`}
            >
              {excerpt(entry.body, entry.title ? 120 : 180)}
            </p>
          ) : null}

          {entry.profiles.length > 0 || entry.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {entry.profiles.slice(0, 3).map((profile) => (
                <span
                  key={profile.id}
                  className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-muted"
                >
                  {profile.name}
                </span>
              ))}
              {entry.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10.5px] text-faint">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
