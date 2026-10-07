import { toast } from "sonner";
import { messageForError, type ErrorContext } from "@/lib/api/errorMessages";

/** Single place that emits toasts: success text is fixed Portuguese, error text comes from `messageForError`. */
export function notifySuccess(message: string): void {
  toast.success(message);
}

export function notifyInfo(message: string): void {
  toast.info(message);
}

export function notifyError(error: unknown, context?: ErrorContext): void {
  toast.error(messageForError(error, context));
}

/** An error toast with a text of its own, for failures that do not come from the API (the same red toast as `notifyError`). */
export function notifyErrorMessage(message: string): void {
  toast.error(message);
}
