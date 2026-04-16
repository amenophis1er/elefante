import React from "react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", destructive, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      {/* Dialog */}
      <div className="relative bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-xl px-6 py-5 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-1">{title}</h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-sm px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`text-sm px-4 py-2 rounded-lg text-white transition-colors ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#7B7FBF] hover:bg-[#6A6EAE]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
