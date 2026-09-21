import { lazy, Suspense, useState } from "react";
import type { Props } from "./TaskFormDialogImpl";

// The form, its validation and its selects load the first time it is opened, so
// they are not part of every page's first-load JavaScript (NFR-04).
const TaskFormDialogImpl = lazy(() => import("./TaskFormDialogImpl"));

export function TaskFormDialog(props: Props) {
  const [wanted, setWanted] = useState(props.open);
  if (props.open && !wanted) setWanted(true);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <TaskFormDialogImpl {...props} />
    </Suspense>
  );
}
