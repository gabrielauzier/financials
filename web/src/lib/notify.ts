import { toast } from "sonner";
import { messageForError, type ErrorContext } from "@/lib/api/errorMessages";

/** Single place that emits toasts: success text is fixed Portuguese, error text comes from `messageForError`. */
export function notifySuccess(message: string): void {
  toast.success(message);
}

export function notifyError(error: unknown, context?: ErrorContext): void {
  toast.error(messageForError(error, context));
}
