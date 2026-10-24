export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <p
      role="status"
      className={`rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
        error
          ? "border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_9%,transparent)] text-danger"
          : "border border-[color-mix(in_srgb,var(--sage)_25%,transparent)] bg-[var(--sage-soft)] text-sage"
      }`}
    >
      {error || success}
    </p>
  );
}
