import { t } from "@/i18n";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";

/** Every AI result carries this label (FR-423, TH-405). */
export function AiLabel() {
  return (
    <Badge tone="info" icon="sparkles">
      {t("ai.label")}
    </Badge>
  );
}

export function PrivacyNotice({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{t("ai.privacy.title")}</h3>
      <p className="text-sm">{t("ai.privacy.body")}</p>
      <Button variant="primary" onClick={onAccept} className="self-start">
        {t("ai.privacy.accept")}
      </Button>
    </div>
  );
}
