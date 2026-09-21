import { lazy, Suspense, useState } from "react";
import type { DialogProps } from "./DialogImpl";

// Radix Dialog (with its focus trap and scroll lock) is ~20 KB gzip. Nothing
// needs it until a dialog is first opened, so it loads then (NFR-04).
const DialogImpl = lazy(() => import("./DialogImpl"));

export function Dialog(props: DialogProps) {
  const [wanted, setWanted] = useState(props.open);
  if (props.open && !wanted) setWanted(true);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <DialogImpl {...props} />
    </Suspense>
  );
}
