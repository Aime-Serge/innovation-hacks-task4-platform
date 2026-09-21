"use client";

import { useState } from "react";
import { t } from "@/i18n";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { IconButton } from "@/ui/IconButton";
import { NavLinks } from "./NavLinks";

/** Below lg the sidebar becomes a drawer (FR-19). */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <IconButton label={t("layout.openMenu")} onClick={() => setOpen(true)}>
        <Icon name="menu" />
      </IconButton>
      <Dialog open={open} onOpenChange={setOpen} title={t("layout.menu")} variant="drawer">
        <nav aria-label={t("layout.primaryNav")}>
          <NavLinks onNavigate={() => setOpen(false)} />
        </nav>
      </Dialog>
    </div>
  );
}
