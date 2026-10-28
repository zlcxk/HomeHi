"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { saveTripPlaceAction } from "@/app/actions/travel";
import { LocationField } from "@/components/pickers/LocationField";
import { SaveBar } from "@/components/compose/SaveBar";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";

const initialState: ActionState = {};

export type PlaceInitial = {
  id: string;
  name: string;
  region: string;
  address: string;
  note: string;
  latitude: number | null;
  longitude: number | null;
};

export function PlaceForm({
  tripId,
  tripTitle,
  initial,
}: {
  tripId: string;
  tripTitle: string;
  initial?: PlaceInitial;
}) {
  const router = useRouter();
  const [state, action] = useActionState(saveTripPlaceAction, initialState);
  const [region, setRegion] = useState(initial?.region || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    initial?.latitude != null && initial?.longitude != null
      ? { latitude: initial.latitude, longitude: initial.longitude }
      : null,
  );
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
        <p className="eyebrow">{tripTitle}</p>
        <h1 className="font-display mt-1.5 text-[32px] leading-tight">
          {editing ? "编辑地点" : "添加地点"}
        </h1>
      </header>

      <form action={action}>
        <input type="hidden" name="tripId" value={tripId} />
        {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
        <input type="hidden" name="latitude" value={coordinates?.latitude ?? ""} />
        <input type="hidden" name="longitude" value={coordinates?.longitude ?? ""} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <LocationField
              name="name"
              label="地点名称"
              defaultValue={initial?.name || ""}
              placeholder="搜索高德地点，或直接输入名称"
              onPick={(suggestion) => {
                // 城市/地区只留到市一级，和模板里的地区写法保持一致
                const city = (suggestion.city || suggestion.province).replace(
                  /(市|省|特别行政区)$/,
                  "",
                );
                setRegion(city || suggestion.district);
                setAddress(suggestion.fullAddress);
                setCoordinates(
                  suggestion.latitude != null && suggestion.longitude != null
                    ? { latitude: suggestion.latitude, longitude: suggestion.longitude }
                    : null,
                );
              }}
              onInput={() => setCoordinates(null)}
            />
            <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-faint">
              <MapPin size={11} />
              输入两个字以上会搜索高德地点，选中后自动填好城市和地址；搜不到也可以直接手填。
            </p>
          </div>

          <div>
            <label className="label" htmlFor="place-region">
              城市 / 地区
            </label>
            <input
              id="place-region"
              name="region"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              placeholder="上海"
              maxLength={80}
              className="field"
            />
          </div>

          <div>
            <label className="label" htmlFor="place-address">
              地址
            </label>
            <input
              id="place-address"
              name="address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="可选"
              maxLength={200}
              className="field"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="place-note">
              备注
            </label>
            <textarea
              id="place-note"
              name="note"
              defaultValue={initial?.note || ""}
              rows={3}
              maxLength={2000}
              placeholder="想看的展厅、预约方式、开放时间…"
              className="field"
            />
          </div>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-faint">
          <MapPin size={12} /> 保存后可以在这里打卡，记录到访日期和照片。
        </p>

        <div className="mt-5">
          <FormMessage error={state.error} />
        </div>

        <SaveBar>
          <SubmitButton className="btn btn-primary btn-lg w-full sm:w-auto">
            {editing ? "保存地点" : "添加地点"}
          </SubmitButton>
        </SaveBar>
      </form>
    </div>
  );
}
