"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function ConfirmButton({
  children,
  message = "确定删除吗？此操作不可撤销。",
  className = "btn btn-ghost btn-sm",
  pendingText = "处理中…",
}: {
  children: ReactNode;
  message?: string;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
