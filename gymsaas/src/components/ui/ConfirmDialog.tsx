"use client";

import { Sheet } from "./Sheet";
import { Button } from "./Button";

/** Mobile-first confirm dialog for destructive actions (archive, deactivate). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  isLoading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} className="sm:w-auto w-full">
            Cancel
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            isLoading={isLoading}
            className="sm:w-auto w-full"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {description ? <p className="text-sm text-muted">{description}</p> : null}
    </Sheet>
  );
}
