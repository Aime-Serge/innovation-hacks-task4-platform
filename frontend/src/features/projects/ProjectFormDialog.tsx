import { lazy, Suspense, useState } from "react";
import type { Props } from "./ProjectFormDialogImpl";

// The form, its validation and its selects load the first time it is opened, so
// they are not part of every page's first-load JavaScript (NFR-04).
const ProjectFormDialogImpl = lazy(() => import("./ProjectFormDialogImpl"));

export function ProjectFormDialog(props: Props) {
  const [wanted, setWanted] = useState(props.open);
  if (props.open && !wanted) setWanted(true);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <ProjectFormDialogImpl {...props} />
    </Suspense>
  );
}
