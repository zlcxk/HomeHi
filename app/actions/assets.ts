"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/auth";
import { dateInputToUtc } from "@/lib/dates";
import { removeAssetReferences } from "@/lib/asset-links";
import {
  assetSchema,
  firstError,
  formString,
  type ActionState,
} from "@/lib/validation";

function revalidateAssetSurfaces(id?: string) {
  revalidatePath("/assets");
  revalidatePath("/today");
  revalidatePath("/search");
  revalidatePath("/my");
  if (id) revalidatePath(`/assets/${id}`);
}

export async function saveAssetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getContext();
  if (!context) return { error: "登录已失效，请重新登录" };
  const id = formString(formData, "id");
  const timezone = context.household.timezone;

  const parsed = assetSchema.safeParse({
    name: formString(formData, "name"),
    category: formString(formData, "category") || "OTHER",
    status: formString(formData, "status") || "ACTIVE",
    brand: formString(formData, "brand"),
    model: formString(formData, "model"),
    serialNumber: formString(formData, "serialNumber"),
    location: formString(formData, "location"),
    purchaseDate: formString(formData, "purchaseDate"),
    purchasePrice: formString(formData, "purchasePrice"),
    vendor: formString(formData, "vendor"),
    warrantyUntil: formString(formData, "warrantyUntil"),
    maintenanceEveryDays: formString(formData, "maintenanceEveryDays"),
    insuranceUntil: formString(formData, "insuranceUntil"),
    insuranceProvider: formString(formData, "insuranceProvider"),
    notes: formString(formData, "notes"),
    photoMediaId: formString(formData, "photoMediaId"),
    visibility: formString(formData, "visibility") || "HOUSEHOLD",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;

  const purchaseDate = data.purchaseDate ? dateInputToUtc(data.purchaseDate, timezone) : null;
  const warrantyUntil = data.warrantyUntil ? dateInputToUtc(data.warrantyUntil, timezone) : null;
  const insuranceUntil = data.insuranceUntil ? dateInputToUtc(data.insuranceUntil, timezone) : null;
  if (data.purchaseDate && !purchaseDate) return { error: "购买日期格式不正确" };
  if (data.warrantyUntil && !warrantyUntil) return { error: "质保日期格式不正确" };
  if (data.insuranceUntil && !insuranceUntil) return { error: "保险日期格式不正确" };

  let purchasePrice: number | null = null;
  if (data.purchasePrice) {
    const value = Number(data.purchasePrice);
    if (!Number.isFinite(value) || value < 0) return { error: "价格需要填写正数" };
    purchasePrice = Math.round(value * 100) / 100;
  }

  let maintenanceEveryDays: number | null = null;
  if (data.maintenanceEveryDays) {
    const value = Number(data.maintenanceEveryDays);
    if (!Number.isInteger(value) || value <= 0 || value > 3650) {
      return { error: "保养周期请填写 1–3650 天" };
    }
    maintenanceEveryDays = value;
  }

  let photoMediaId: string | null = null;
  if (data.photoMediaId) {
    const media = await prisma.media.findFirst({
      where: {
        id: data.photoMediaId,
        householdId: context.household.id,
        status: "ACTIVE",
        OR: [{ visibility: "HOUSEHOLD" }, { uploadedBy: context.user.id }],
      },
      select: { id: true },
    });
    photoMediaId = media?.id ?? null;
  }

  const payload = {
    name: data.name,
    category: data.category,
    status: data.status,
    brand: data.brand || null,
    model: data.model || null,
    serialNumber: data.serialNumber || null,
    location: data.location || null,
    purchaseDate,
    purchasePrice,
    vendor: data.vendor || null,
    warrantyUntil,
    maintenanceEveryDays,
    insuranceUntil,
    insuranceProvider: data.insuranceProvider || null,
    notes: data.notes || null,
    photoMediaId,
    visibility: data.visibility,
  };

  let assetId = id;
  if (id) {
    const existing = await prisma.asset.findFirst({
      where: {
        id,
        householdId: context.household.id,
        OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
      },
    });
    if (!existing) return { error: "物品不存在或没有编辑权限" };
    await prisma.asset.update({ where: { id }, data: payload });
  } else {
    const created = await prisma.asset.create({
      data: {
        ...payload,
        householdId: context.household.id,
        createdBy: context.user.id,
      },
    });
    assetId = created.id;
  }

  revalidateAssetSurfaces(assetId);
  redirect(`/assets/${assetId}`);
}

export async function deleteAssetAction(formData: FormData): Promise<void> {
  const context = await getContext();
  if (!context) redirect("/login");
  const id = formString(formData, "id");
  const asset = await prisma.asset.findFirst({
    where: {
      id,
      householdId: context.household.id,
      OR: [{ visibility: "HOUSEHOLD" }, { createdBy: context.user.id }],
    },
  });
  if (!asset) redirect("/assets");

  await removeAssetReferences(context.household.id, id);
  await prisma.asset.delete({ where: { id } });
  revalidateAssetSurfaces();
  redirect("/assets");
}
