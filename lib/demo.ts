import { createHash } from "node:crypto";
import { DateTime } from "luxon";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { DEMO_SETTING_KEY } from "@/lib/constants";
import { getStorageDriver, makeStorageKey, makeThumbKey, removeStoredFile } from "@/lib/storage";
import { syncReminderNotifications } from "@/lib/reminders";

type DemoPalette = {
  from: string;
  to: string;
  accent: string;
  shape: string;
};

const PALETTES: DemoPalette[] = [
  { from: "#f0b078", to: "#cf5a33", accent: "#fff2df", shape: "#8d3f24" },
  { from: "#dfe8d7", to: "#5a7660", accent: "#f9f6ec", shape: "#33472f" },
  { from: "#f4e4ce", to: "#b98c51", accent: "#fffaf0", shape: "#6d4c28" },
  { from: "#33404b", to: "#a67c3d", accent: "#f3e4c3", shape: "#1e262d" },
  { from: "#f3dcc6", to: "#c08a6a", accent: "#fff6ea", shape: "#7c4b34" },
  { from: "#e8e1d2", to: "#8e9a83", accent: "#fbf8f0", shape: "#505b48" },
];

function demoImageSvg(palette: DemoPalette, index: number): string {
  const circles = [
    `<circle cx="840" cy="260" r="150" fill="${palette.accent}" opacity="0.88"/>`,
    `<circle cx="300" cy="300" r="210" fill="${palette.accent}" opacity="0.35"/>`,
    `<circle cx="950" cy="600" r="240" fill="${palette.shape}" opacity="0.4"/>`,
    `<circle cx="220" cy="640" r="170" fill="${palette.accent}" opacity="0.5"/>`,
    `<circle cx="600" cy="220" r="120" fill="${palette.shape}" opacity="0.3"/>`,
    `<circle cx="760" cy="420" r="180" fill="${palette.accent}" opacity="0.3"/>`,
  ][index % 6];
  const wave = index % 2 === 0 ? 520 : 590;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.from}"/>
      <stop offset="100%" stop-color="${palette.to}"/>
    </linearGradient>
    <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <rect width="1200" height="900" fill="url(#haze)"/>
  ${circles}
  <path d="M0 ${wave} C 260 ${wave - 120}, 420 ${wave + 90}, 660 ${wave - 20} S 1030 ${wave - 130}, 1200 ${wave - 40} L1200 900 L0 900 Z" fill="${palette.shape}" opacity="0.55"/>
  <path d="M0 ${wave + 120} C 300 ${wave + 30}, 520 ${wave + 190}, 800 ${wave + 80} S 1080 ${wave + 40}, 1200 ${wave + 110} L1200 900 L0 900 Z" fill="${palette.shape}" opacity="0.75"/>
  <g opacity="0.55" stroke="${palette.accent}" stroke-width="3" stroke-linecap="round">
    <path d="M140 170 q 40 -40 80 0"/>
    <path d="M190 205 q 30 -26 58 0"/>
  </g>
</svg>`;
}

async function createDemoImage(index: number, caption: string, takenAt: Date, context: DemoContext) {
  const palette = PALETTES[index % PALETTES.length];
  const svg = Buffer.from(demoImageSvg(palette, index));
  const jpeg = await sharp(svg).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  const thumb = await sharp(svg).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();

  const storageKey = makeStorageKey("jpg");
  const thumbnailKey = makeThumbKey();
  const driver = await getStorageDriver();
  await driver.put(storageKey, jpeg, "image/jpeg");
  await driver.put(thumbnailKey, thumb, "image/webp");

  return prisma.media.create({
    data: {
      householdId: context.householdId,
      uploadedBy: context.userId,
      mediaType: "IMAGE",
      originalFilename: `demo-${index + 1}.jpg`,
      mimeType: "image/jpeg",
      fileSize: jpeg.byteLength,
      storageKey,
      storageDriver: driver.kind,
      thumbnailKey,
      width: 1200,
      height: 900,
      takenAt,
      caption,
      visibility: "HOUSEHOLD",
      isDemo: true,
      checksum: createHash("sha256").update(jpeg).digest("hex"),
    },
  });
}

type DemoContext = {
  householdId: string;
  userId: string;
  timezone: string;
};

export async function seedDemoData(context: DemoContext): Promise<{ created: boolean; media: number }> {
  const existing = await prisma.appSetting.findUnique({ where: { key: DEMO_SETTING_KEY } });
  if (existing?.value === "true") return { created: false, media: 0 };

  const zone = context.timezone;
  const now = DateTime.now().setZone(zone);

  const [child, pet] = await Promise.all([
    prisma.familyProfile.create({
      data: {
        householdId: context.householdId,
        profileType: "PERSON",
        name: "小满",
        birthday: now.plus({ days: 12 }).startOf("day").toUTC().toJSDate(),
        joinedDate: now.minus({ years: 6 }).startOf("day").toUTC().toJSDate(),
        description: "喜欢画画和恐龙，最近在学骑自行车。",
        isDemo: true,
      },
    }),
    prisma.familyProfile.create({
      data: {
        householdId: context.householdId,
        profileType: "PET",
        name: "阿福",
        species: "狗",
        breed: "柯基",
        birthday: now.minus({ years: 2 }).plus({ days: 40 }).startOf("day").toUTC().toJSDate(),
        joinedDate: now.minus({ years: 2 }).startOf("day").toUTC().toJSDate(),
        description: "短腿，爱追落叶，握手刚学会一半。",
        isDemo: true,
      },
    }),
  ]);

  const takenAt = (daysAgo: number, hour = 17) =>
    now.minus({ days: daysAgo }).set({ hour, minute: 20, second: 0, millisecond: 0 }).toUTC().toJSDate();

  const mediaSpecs = [
    { caption: "傍晚的窗台", at: takenAt(0, 16) },
    { caption: "路上遇到的光", at: takenAt(3, 18) },
    { caption: "周末的小路", at: takenAt(9, 10) },
    { caption: "厨房里的下午", at: takenAt(9, 15) },
    { caption: "阿福在等球", at: takenAt(30, 17) },
    { caption: "一年前的今天", at: takenAt(365, 17) },
  ];

  const media: Awaited<ReturnType<typeof createDemoImage>>[] = [];
  for (let index = 0; index < mediaSpecs.length; index += 1) {
    media.push(
      await createDemoImage(index, mediaSpecs[index].caption, mediaSpecs[index].at, context),
    );
  }

  const oneYearAgo = now.minus({ years: 1 }).set({ hour: 17, minute: 30 }).toUTC().toJSDate();

  const moments = [
    {
      entryType: "MOMENT",
      title: null,
      body: "今天的光特别好，落在窗台上，像是把整个下午都晒暖了。",
      occurredAt: takenAt(0, 16),
      media: [media[0]],
      profiles: [] as string[],
    },
    {
      entryType: "STORY",
      title: "周末的小旅行",
      body: "没有去很远的地方，只是沿着河边走了很久。\n\n小满捡了一兜石子，阿福在草地上跑得停不下来。回家路上买了两个烤红薯，坐在车里吃完才上楼。\n\n这样的一天，好像什么也没做，又好像什么都做了。",
      occurredAt: takenAt(9, 11),
      media: [media[2], media[3]],
      profiles: [child.id, pet.id],
    },
    {
      entryType: "MOMENT",
      title: null,
      body: "阿福第一次学会握手，虽然只坚持了两秒。",
      occurredAt: takenAt(30, 17),
      media: [media[4]],
      profiles: [pet.id],
    },
    {
      entryType: "MOMENT",
      title: null,
      body: "一年前的今天。那时候还没有现在这么忙，晚饭后总会下楼走一圈。",
      occurredAt: oneYearAgo,
      media: [media[5]],
      profiles: [],
    },
    {
      entryType: "MOMENT",
      title: null,
      body: "烤面包的香味从厨房飘出来，整个家都变得很软。",
      occurredAt: takenAt(3, 15),
      media: [media[1]],
      profiles: [child.id],
    },
  ];

  for (const moment of moments) {
    await prisma.entry.create({
      data: {
        householdId: context.householdId,
        createdBy: context.userId,
        entryType: moment.entryType,
        title: moment.title,
        body: moment.body,
        occurredAt: moment.occurredAt,
        coverMediaId: moment.media[0]?.id ?? null,
        visibility: "HOUSEHOLD",
        status: "PUBLISHED",
        isDemo: true,
        media: {
          create: moment.media.map((item, index) => ({ mediaId: item.id, sortOrder: index })),
        },
        profiles: {
          create: moment.profiles.map((profileId) => ({ profileId })),
        },
      },
    });
  }

  const album = await prisma.album.create({
    data: {
      householdId: context.householdId,
      name: "最近的日子",
      description: "示例相册。可以随时清空，换成你们自己的照片。",
      coverMediaId: media[1].id,
      createdBy: context.userId,
      isDemo: true,
    },
  });
  await prisma.albumMedia.createMany({
    data: [media[0], media[1], media[2], media[4]].map((item, index) => ({
      albumId: album.id,
      mediaId: item.id,
      sortOrder: index,
    })),
  });

  const [fridge, car] = await Promise.all([
    prisma.asset.create({
      data: {
        householdId: context.householdId,
        createdBy: context.userId,
        name: "厨房冰箱",
        category: "APPLIANCE",
        brand: "海尔",
        model: "BCD-501",
        location: "厨房",
        purchaseDate: now.minus({ years: 2 }).startOf("day").toUTC().toJSDate(),
        purchasePrice: 4299,
        vendor: "京东",
        warrantyUntil: now.plus({ months: 10 }).startOf("day").toUTC().toJSDate(),
        maintenanceEveryDays: 180,
        notes: "滤芯型号在说明书最后一页。",
        visibility: "HOUSEHOLD",
        isDemo: true,
      },
    }),
    prisma.asset.create({
      data: {
        householdId: context.householdId,
        createdBy: context.userId,
        name: "家里的车",
        category: "VEHICLE",
        brand: "大众",
        model: "高尔夫",
        location: "地下车库 B2",
        purchaseDate: now.minus({ years: 4 }).startOf("day").toUTC().toJSDate(),
        purchasePrice: 158000,
        warrantyUntil: now.plus({ days: 20 }).startOf("day").toUTC().toJSDate(),
        maintenanceEveryDays: 365,
        insuranceUntil: now.plus({ months: 5 }).startOf("day").toUTC().toJSDate(),
        insuranceProvider: "平安车险",
        visibility: "HOUSEHOLD",
        isDemo: true,
      },
    }),
  ]);

  const nextFriday = (() => {
    let candidate = now.startOf("day").plus({ days: 1 }).set({ hour: 20, minute: 0 });
    while (candidate.weekday !== 5) candidate = candidate.plus({ days: 1 });
    return candidate;
  })();

  const movieNight = await prisma.calendarEvent.create({
    data: {
      householdId: context.householdId,
      createdBy: context.userId,
      title: "家庭电影夜",
      description: "挑一部大家都想看的，准备一点零食。",
      startsAt: nextFriday.toUTC().toJSDate(),
      endsAt: nextFriday.plus({ hours: 2 }).toUTC().toJSDate(),
      isAllDay: false,
      timezone: zone,
      recurrenceType: "WEEKLY",
      recurrenceInterval: 1,
      visibility: "HOUSEHOLD",
      isDemo: true,
      relatedProfileIds: JSON.stringify([child.id]),
    },
  });

  const birthdayStart = now.plus({ days: 12 }).set({ hour: 9, minute: 0 });
  const birthdayEvent = await prisma.calendarEvent.create({
    data: {
      householdId: context.householdId,
      createdBy: context.userId,
      title: "小满的生日",
      description: "提前订蛋糕，问问她想请谁。",
      startsAt: birthdayStart.toUTC().toJSDate(),
      isAllDay: true,
      timezone: zone,
      recurrenceType: "YEARLY",
      recurrenceInterval: 1,
      visibility: "HOUSEHOLD",
      isDemo: true,
      relatedProfileIds: JSON.stringify([child.id]),
    },
  });

  for (const event of [movieNight, birthdayEvent]) {
    await prisma.reminderRule.create({
      data: {
        householdId: context.householdId,
        targetType: "CALENDAR_EVENT",
        targetId: event.id,
        offsets: JSON.stringify(event.isAllDay ? [1440, 10080] : [60]),
        recipientUserIds: "[]",
        enabled: true,
      },
    });
    await syncReminderNotifications("CALENDAR_EVENT", event.id, "refresh");
  }

  const dogFood = await prisma.task.create({
    data: {
      householdId: context.householdId,
      createdBy: context.userId,
      title: "给阿福买狗粮",
      description: "上次买的那个牌子，记得看看有没有活动。",
      dueAt: now.plus({ days: 1 }).set({ hour: 18, minute: 0 }).toUTC().toJSDate(),
      priority: "IMPORTANT",
      visibility: "HOUSEHOLD",
      isDemo: true,
      relatedProfileIds: JSON.stringify([pet.id]),
    },
  });

  const utilities = await prisma.task.create({
    data: {
      householdId: context.householdId,
      createdBy: context.userId,
      title: "交水电费",
      dueAt: now.plus({ days: 3 }).set({ hour: 10, minute: 0 }).toUTC().toJSDate(),
      recurrenceType: "MONTHLY",
      recurrenceInterval: 1,
      visibility: "HOUSEHOLD",
      isDemo: true,
    },
  });

  await prisma.task.create({
    data: {
      householdId: context.householdId,
      createdBy: context.userId,
      title: "整理上个月的照片",
      description: "挑几张放进相册，再删掉模糊的。",
      visibility: "HOUSEHOLD",
      isDemo: true,
    },
  });

  const fridgeFilter = await prisma.task.create({
    data: {
      householdId: context.householdId,
      createdBy: context.userId,
      title: "更换冰箱滤芯",
      dueAt: now.plus({ days: 45 }).set({ hour: 10, minute: 0 }).toUTC().toJSDate(),
      recurrenceType: "YEARLY",
      recurrenceInterval: 1,
      visibility: "HOUSEHOLD",
      isDemo: true,
      relatedAssetIds: JSON.stringify([fridge.id]),
    },
  });

  const carService = await prisma.task.create({
    data: {
      householdId: context.householdId,
      createdBy: context.userId,
      title: "预约车辆保养",
      description: "顺便检查一下刹车片。",
      dueAt: now.plus({ days: 20 }).set({ hour: 10, minute: 0 }).toUTC().toJSDate(),
      visibility: "HOUSEHOLD",
      isDemo: true,
      relatedAssetIds: JSON.stringify([car.id]),
    },
  });

  for (const task of [dogFood, utilities, fridgeFilter, carService]) {
    await prisma.reminderRule.create({
      data: {
        householdId: context.householdId,
        targetType: "TASK",
        targetId: task.id,
        offsets: JSON.stringify([1440]),
        recipientUserIds: "[]",
        enabled: true,
      },
    });
    await syncReminderNotifications("TASK", task.id, "refresh");
  }

  await prisma.appSetting.upsert({
    where: { key: DEMO_SETTING_KEY },
    create: { key: DEMO_SETTING_KEY, value: "true", householdId: context.householdId },
    update: { value: "true", householdId: context.householdId },
  });

  return { created: true, media: media.length };
}

export async function clearDemoData(householdId: string): Promise<void> {
  const [media, events, tasks] = await Promise.all([
    prisma.media.findMany({ where: { householdId, isDemo: true } }),
    prisma.calendarEvent.findMany({ where: { householdId, isDemo: true }, select: { id: true } }),
    prisma.task.findMany({ where: { householdId, isDemo: true }, select: { id: true } }),
  ]);

  const eventIds = events.map((event) => event.id);
  const taskIds = tasks.map((task) => task.id);

  if (eventIds.length > 0) {
    await prisma.notification.deleteMany({
      where: { targetType: "CALENDAR_EVENT", targetId: { in: eventIds } },
    });
    await prisma.reminderRule.deleteMany({
      where: { targetType: "CALENDAR_EVENT", targetId: { in: eventIds } },
    });
  }
  if (taskIds.length > 0) {
    await prisma.notification.deleteMany({
      where: { targetType: "TASK", targetId: { in: taskIds } },
    });
    await prisma.reminderRule.deleteMany({
      where: { targetType: "TASK", targetId: { in: taskIds } },
    });
  }

  await prisma.$transaction([
    prisma.entry.deleteMany({ where: { householdId, isDemo: true } }),
    prisma.album.deleteMany({ where: { householdId, isDemo: true } }),
    prisma.asset.deleteMany({ where: { householdId, isDemo: true } }),
    prisma.familyProfile.deleteMany({ where: { householdId, isDemo: true } }),
    prisma.calendarEvent.deleteMany({ where: { householdId, isDemo: true } }),
    prisma.task.deleteMany({ where: { householdId, isDemo: true } }),
    prisma.media.deleteMany({ where: { householdId, isDemo: true } }),
    prisma.appSetting.deleteMany({ where: { key: DEMO_SETTING_KEY } }),
  ]);

  await Promise.all(
    media.flatMap((item) => [
      removeStoredFile(item.storageKey, item.storageDriver),
      removeStoredFile(item.thumbnailKey, item.storageDriver),
    ]),
  );
}
