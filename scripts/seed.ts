import "dotenv/config";

import { prisma } from "../lib/db";
import { seedDemoData } from "../lib/demo";

async function main() {
  const household = await prisma.household.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      members: {
        where: { role: "OWNER" },
        include: { user: true },
        take: 1,
      },
    },
  });

  if (!household) {
    console.log("还没有家庭空间。请先运行应用，打开 /setup 完成初始化。");
    console.log("初始化之后，可以运行 `npm run seed` 载入示例数据，或在「设置 → 数据」中一键载入。");
    return;
  }

  const owner = household.members[0]?.user;
  if (!owner) {
    console.log("这个家庭空间还没有管理员账号，跳过示例数据。");
    return;
  }

  const result = await seedDemoData({
    householdId: household.id,
    userId: owner.id,
    timezone: household.timezone,
  });

  if (result.created) {
    console.log(`已载入示例数据（${result.media} 张本地生成的照片）。`);
  } else {
    console.log("示例数据已经载入过了。可在「设置 → 数据」中清空后重新载入。");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
