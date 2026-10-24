import { AppNavigation } from "@/components/AppNavigation";
import { requireContext } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await requireContext();

  return (
    <div className="min-h-dvh">
      <AppNavigation
        userName={context.user.displayName}
        userEmail={context.user.email}
        householdName={context.household.name}
      />
      <div className="lg:pl-[254px]">
        <div className="mx-auto w-full max-w-[920px] px-4 pt-[max(22px,env(safe-area-inset-top))] sm:px-6 lg:px-10 lg:pt-10">
          <div className="page-pad">{children}</div>
        </div>
      </div>
    </div>
  );
}
