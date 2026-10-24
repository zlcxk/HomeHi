import { requireContext } from "@/lib/auth";

export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  await requireContext();
  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto w-full max-w-[680px] px-4 sm:px-6">{children}</div>
    </div>
  );
}
