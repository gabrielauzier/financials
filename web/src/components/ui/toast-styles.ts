/**
 * Toast classes by type. The colors live only in the per-type keys (never in `toast`), so a toast never
 * carries two background classes whose winner would depend on the order of the generated CSS.
 * `group-[.toaster]:` (the wrapper's prefix) beats sonner's own CSS; `dark:` follows the project's
 * `@custom-variant dark`. Success is green, error is red; info and the types nothing emits yet
 * (default, warning, loading) use the theme's own surface and text colors.
 */
const neutral =
  "group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border";

export const toastClassNames = {
  toast: "group toast group-[.toaster]:shadow-lg",
  success:
    "group-[.toaster]:bg-emerald-50 group-[.toaster]:text-emerald-900 group-[.toaster]:border-emerald-300 dark:group-[.toaster]:bg-emerald-950 dark:group-[.toaster]:text-emerald-100 dark:group-[.toaster]:border-emerald-800",
  error:
    "group-[.toaster]:bg-red-50 group-[.toaster]:text-red-900 group-[.toaster]:border-red-300 dark:group-[.toaster]:bg-red-950 dark:group-[.toaster]:text-red-100 dark:group-[.toaster]:border-red-800",
  info: neutral,
  default: neutral,
  warning: neutral,
  loading: neutral,
  description: "group-[.toast]:text-current",
  actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
  cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
};
