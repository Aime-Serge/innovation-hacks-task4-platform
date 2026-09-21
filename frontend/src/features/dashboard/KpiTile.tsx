import { Card } from "@/ui/Card";
import { Icon, type IconName } from "@/ui/Icon";

type KpiTileProps = { label: string; value: string; icon: IconName };

export function KpiTile({ label, value, icon }: KpiTileProps) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="flex items-center gap-2 text-sm text-muted">
        <Icon name={icon} />
        {label}
      </p>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}
