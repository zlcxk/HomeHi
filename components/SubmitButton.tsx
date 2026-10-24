"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  pendingText = "保存中…",
  className = "btn btn-primary",
  formAction,
  name,
  value,
  disabled,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending || disabled}
      formAction={formAction}
      name={name}
      value={value}
    >
      {pending ? pendingText : children}
    </button>
  );
}
