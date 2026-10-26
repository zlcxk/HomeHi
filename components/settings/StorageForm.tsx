"use client";

import { useActionState, useState } from "react";
import { Cloud, HardDrive, PlugZap, Save } from "lucide-react";
import { updateStorageAction } from "@/app/actions/settings";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/validation";
import type { StorageKind } from "@/lib/storage/types";

const initialState: ActionState = {};

export type StorageFormProps = {
  driver: StorageKind;
  oss: {
    region: string;
    bucket: string;
    accessKeyId: string;
    endpoint: string;
    prefix: string;
    hasSecret: boolean;
  } | null;
};

export function StorageForm({ driver, oss }: StorageFormProps) {
  const [state, action] = useActionState(updateStorageAction, initialState);
  const [kind, setKind] = useState<StorageKind>(driver);

  return (
    <form action={action} className="mt-4 space-y-4">
      <div>
        <label className="label" htmlFor="storage-driver">
          存储后端
        </label>
        <select
          id="storage-driver"
          name="driver"
          value={kind}
          onChange={(event) => setKind(event.target.value as StorageKind)}
          className="field"
        >
          <option value="LOCAL">本地磁盘</option>
          <option value="OSS">阿里云 OSS</option>
        </select>
        <p className="field-hint">
          切换只影响之后上传的新文件。已有文件的存放位置记录在每条媒体记录里，仍会从原来的位置读取。
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-raised/60 px-3.5 py-2.5 text-[11px] text-muted">
        {kind === "LOCAL" ? <HardDrive size={14} /> : <Cloud size={14} />}
        {kind === "LOCAL"
          ? "照片和视频写入服务器磁盘的 STORAGE_DIR 目录。"
          : "照片和视频写入阿里云 OSS，服务器只保留数据库。"}
      </div>

      <div className={`space-y-4 rounded-xl border border-line p-3.5 ${kind === "OSS" ? "" : "hidden"}`}>
        <p className="text-[11px] leading-relaxed text-faint">
          在阿里云控制台创建一个 Bucket，并为 HomeHi 单独创建一个只能读写该 Bucket 的 RAM 子账号。
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="oss-region">
              Region
            </label>
            <input
              id="oss-region"
              name="ossRegion"
              defaultValue={oss?.region ?? ""}
              placeholder="oss-cn-hangzhou"
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="oss-bucket">
              Bucket
            </label>
            <input
              id="oss-bucket"
              name="ossBucket"
              defaultValue={oss?.bucket ?? ""}
              placeholder="homehi-photos"
              className="field"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="oss-access-key-id">
            AccessKey ID
          </label>
          <input
            id="oss-access-key-id"
            name="ossAccessKeyId"
            defaultValue={oss?.accessKeyId ?? ""}
            autoComplete="off"
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="oss-access-key-secret">
            AccessKey Secret
          </label>
          <input
            id="oss-access-key-secret"
            name="ossAccessKeySecret"
            type="password"
            autoComplete="new-password"
            placeholder={oss?.hasSecret ? "已保存，留空则不修改" : "填写 AccessKey Secret"}
            className="field"
          />
          <p className="field-hint">
            Secret 以明文保存在本机 SQLite 数据库里，不会发送到浏览器。请限制数据库文件的访问权限。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="oss-endpoint">
              Endpoint <span className="text-faint">（可选）</span>
            </label>
            <input
              id="oss-endpoint"
              name="ossEndpoint"
              defaultValue={oss?.endpoint ?? ""}
              placeholder="留空使用默认地址"
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="oss-prefix">
              对象前缀 <span className="text-faint">（可选）</span>
            </label>
            <input
              id="oss-prefix"
              name="ossPrefix"
              defaultValue={oss?.prefix ?? ""}
              placeholder="homehi"
              className="field"
            />
            <p className="field-hint">所有对象会放在这个前缀下，便于和其他数据共用一个 Bucket。</p>
          </div>
        </div>
      </div>

      <FormMessage error={state.error} success={state.success} />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <SubmitButton
          name="intent"
          value="test"
          className="btn btn-outline btn-sm"
          pendingText="测试中…"
        >
          <PlugZap size={13} /> 测试连接
        </SubmitButton>
        <SubmitButton name="intent" value="save" className="btn btn-primary btn-sm">
          <Save size={13} /> 保存
        </SubmitButton>
      </div>
    </form>
  );
}
