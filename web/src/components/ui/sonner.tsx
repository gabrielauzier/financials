import { Toaster as Sonner } from "sonner";
import { toastClassNames } from "./toast-styles";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner className="toaster group" toastOptions={{ classNames: toastClassNames }} {...props} />
  );
};

export { Toaster };
