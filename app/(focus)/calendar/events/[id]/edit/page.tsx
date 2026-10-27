import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toDateInput, toLocalInput } from "@/lib/dates";
import { parseStringArray } from "@/lib/json";
import { parseOffsets } from "@/lib/reminders";
import { assetOptions, profileOptions } from "@/lib/view";
import { smtpStatus } from "@/lib/mailer";
import { EventComposer, type EventInitial } from "@/components/compose/EventComposer";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireContext();
  const timezone = context.household.timezone;

  const event = await prisma.calendarEvent.findFirst({
    where: {
      id,
      householdId: context.household.id,
      OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
    },
  });
  if (!event) notFound();

  const [profiles, assets, rule] = await Promise.all([
    profileOptions(context),
    assetOptions(context),
    prisma.reminderRule.findUnique({
      where: { targetType_targetId: { targetType: "CALENDAR_EVENT", targetId: id } },
    }),
  ]);

  const initial: EventInitial = {
    id: event.id,
    title: event.title,
    description: event.description || "",
    location: event.location || "",
    isAllDay: event.isAllDay,
    start: event.isAllDay
      ? toDateInput(event.startsAt, timezone)
      : toLocalInput(event.startsAt, timezone),
    end: event.endsAt
      ? event.isAllDay
        ? toDateInput(event.endsAt, timezone)
        : toLocalInput(event.endsAt, timezone)
      : "",
    recurrenceType: event.recurrenceType,
    recurrenceInterval: event.recurrenceInterval,
    recurrenceUntil: event.recurrenceUntil ? toDateInput(event.recurrenceUntil, timezone) : "",
    visibility: event.visibility,
    reminderOffsets: rule?.enabled ? parseOffsets(rule.offsets) : [],
    relatedProfileIds: parseStringArray(event.relatedProfileIds),
    relatedAssetIds: parseStringArray(event.relatedAssetIds),
  };

  return (
    <EventComposer
      profiles={profiles}
      assets={assets}
      defaultVisibility={context.user.defaultVisibility}
      smtpConfigured={smtpStatus().configured}
      defaultStart={initial.start}
      initial={initial}
      backHref={`/calendar?date=${initial.start.slice(0, 10)}`}
    />
  );
}
