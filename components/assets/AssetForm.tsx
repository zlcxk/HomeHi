"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Boxes } from "lucide-react";
import { saveAssetAction } from "@/app/actions/assets";
import { MediaUploader } from "@/components/MediaUploader";
import { SaveBar } from "@/components/compose/SaveBar";
import { LocationField } from "@/components/pickers/LocationField";
import { VisibilityControl } from "@/components/pickers/VisibilityControl";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { ASSET_CATEGORIES, ASSET_STATUSES } from "@/lib/assets";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export type AssetInitial = {
  id: string;
  name: string;
  category: string;
  status: string;
  brand: string;
  model: string;
  serialNumber: string;
  location: string;
  purchaseDate: string;
  purchasePrice: string;
  vendor: string;
  warrantyUntil: string;
  maintenanceEveryDays: string;
  insuranceUntil: string;
  insuranceProvider: string;
  notes: string;
  visibility: string;
  photoUrl: string | null;
  photoMediaId: string | null;
};

export function AssetForm({
  initial,
  defaultVisibility,
}: {
  initial?: AssetInitial;
  defaultVisibility: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(saveAssetAction, initialState);
  const [visibility, setVisibility] = useState(
    initial?.visibility || (defaultVisibility === "PRIVATE" ? "PRIVATE" : "HOUSEHOLD"),
  );
  const [busy, setBusy] = useState(false);
  const editing = Boolean(initial);

  return (
    <div>
      <header className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="icon-btn icon-btn-plain -ml-2 mb-3"
          aria-label="返回"
        >
          <ArrowLeft size={19} strokeWidth={1.8} />
        </button>
        <p className="eyebrow">{editing ? "Edit item" : "New item"}</p>
        <h1 className="font-display mt-1.5 text-[32px] leading-tight">
          {editing ? "编辑物品" : "登记一件物品"}
        </h1>
      </header>

      <form action={action}>
        {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

        <div className="mt-5">
          <MediaUploader
            initial={
              initial?.photoMediaId
                ? [
                    {
                      id: initial.photoMediaId,
                      mediaType: "IMAGE",
                      thumbUrl: initial.photoUrl,
                      url: `/api/media/${initial.photoMediaId}/file`,
                    },
                  ]
                : []
            }
            visibility={visibility}
            max={1}
            single
            fieldName="photoMediaId"
            label="照片"
            onBusyChange={setBusy}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="asset-name">
              名称
            </label>
            <input
              id="asset-name"
              name="name"
              defaultValue={initial?.name || ""}
              placeholder="例如：客厅空调"
              maxLength={80}
              required
              className="field"
            />
          </div>

          <div>
            <label className="label" htmlFor="asset-category">
              分类
            </label>
            <select
              id="asset-category"
              name="category"
              defaultValue={initial?.category || "APPLIANCE"}
              className="field"
            >
              {ASSET_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="asset-status">
              状态
            </label>
            <select
              id="asset-status"
              name="status"
              defaultValue={initial?.status || "ACTIVE"}
              className="field"
            >
              {ASSET_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="asset-brand">
              品牌
            </label>
            <input
              id="asset-brand"
              name="brand"
              defaultValue={initial?.brand || ""}
              maxLength={80}
              className="field"
            />
          </div>

          <div>
            <label className="label" htmlFor="asset-model">
              型号
            </label>
            <input
              id="asset-model"
              name="model"
              defaultValue={initial?.model || ""}
              maxLength={80}
              className="field"
            />
          </div>

          <div>
            <label className="label" htmlFor="asset-serial">
              序列号
            </label>
            <input
              id="asset-serial"
              name="serialNumber"
              defaultValue={initial?.serialNumber || ""}
              maxLength={120}
              className="field"
            />
          </div>

          <LocationField
            defaultValue={initial?.location || ""}
            label="放在哪里"
            placeholder="客厅、储藏室…"
          />
        </div>

        <div className="card mt-6 p-4">
          <p className="flex items-center gap-2 text-[13px] font-medium">
            <Boxes size={15} className="text-muted" /> 购买与保障
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="asset-purchase-date">
                购买日期
              </label>
              <input
                id="asset-purchase-date"
                name="purchaseDate"
                type="date"
                defaultValue={initial?.purchaseDate || ""}
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="asset-price">
                价格
              </label>
              <input
                id="asset-price"
                name="purchasePrice"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                defaultValue={initial?.purchasePrice || ""}
                className="field"
              />
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="asset-vendor">
                购买渠道
              </label>
              <input
                id="asset-vendor"
                name="vendor"
                defaultValue={initial?.vendor || ""}
                maxLength={120}
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="asset-warranty">
                质保到
              </label>
              <input
                id="asset-warranty"
                name="warrantyUntil"
                type="date"
                defaultValue={initial?.warrantyUntil || ""}
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="asset-maintenance">
                保养周期（天）
              </label>
              <input
                id="asset-maintenance"
                name="maintenanceEveryDays"
                type="number"
                inputMode="numeric"
                min="1"
                max="3650"
                placeholder="不设则不提醒"
                defaultValue={initial?.maintenanceEveryDays || ""}
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="asset-insurance">
                保险到
              </label>
              <input
                id="asset-insurance"
                name="insuranceUntil"
                type="date"
                defaultValue={initial?.insuranceUntil || ""}
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="asset-insurer">
                保险公司
              </label>
              <input
                id="asset-insurer"
                name="insuranceProvider"
                defaultValue={initial?.insuranceProvider || ""}
                maxLength={120}
                className="field"
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <label className="label" htmlFor="asset-notes">
            备注
          </label>
          <textarea
            id="asset-notes"
            name="notes"
            defaultValue={initial?.notes || ""}
            rows={3}
            maxLength={4000}
            placeholder="保修条款、维修记录、配件位置…"
            className="field"
          />
        </div>

        <div className="mt-6">
          <VisibilityControl initial={visibility} onChange={setVisibility} />
        </div>

        <div className="mt-5">
          <FormMessage error={state.error} />
        </div>

        <SaveBar>
          <SubmitButton className="btn btn-primary btn-lg w-full sm:w-auto" disabled={busy}>
            {busy ? "照片上传中…" : editing ? "保存物品" : "登记物品"}
          </SubmitButton>
        </SaveBar>
      </form>
    </div>
  );
}
