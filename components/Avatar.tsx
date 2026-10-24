import { avatarTone, initials } from "@/lib/format";

export function Avatar({
  name,
  src,
  size = 40,
  className = "",
  ring = false,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const tone = avatarTone(name);
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.34)) };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        className={`shrink-0 rounded-full object-cover ${ring ? "avatar-ring" : ""} ${className}`}
        style={style}
      />
    );
  }
  return (
    <span
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${ring ? "avatar-ring" : ""} ${className}`}
      style={{ ...style, background: tone.background, color: tone.color }}
    >
      {initials(name)}
    </span>
  );
}
