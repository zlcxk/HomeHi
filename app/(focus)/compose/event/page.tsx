import { DateTime } from "luxon";
import { requireContext } from "@/lib/auth";
import { assetOptions, profileOptions, recentLocations } from "@/lib/view";
import { smtpStatus } from "@/lib/mailer";
import { EventComposer } from "@/components/compose/EventComposer";

export default async function ComposeEventPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const context = await requireContext();
  const { date } = await searchParams;
  const [profiles, assets, locations] = await Promise.all([
    profileOptions(context),
    assetOptions(context),
    recentLocations(context),
  ]);
  const timezone = context.household.timezone;

  const start = date
    ? DateTime.fromISO(date, { zone: timezone }).set({ hour: 9, minute: 0 })
    : DateTime.now().setZone(timezone).plus({ minutes: 30 }).set({ second: 0, millisecond: 0 });

  return (
    <EventComposer
      profiles={profiles}
      assets={assets}
      locations={locations}
      defaultVisibility={context.user.defaultVisibility}
      smtpConfigured={smtpStatus().configured}
      defaultStart={start.toFormat("yyyy-MM-dd'T'HH:mm")}
      backHref={date ? `/calendar?date=${date}` : "/calendar"}
    />
  );
}
