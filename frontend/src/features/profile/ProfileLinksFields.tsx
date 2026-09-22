import { t } from "@/i18n";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import type { Fields } from "./profile-editor-fields";

type LinkKey = "github" | "linkedin" | "website";

type Props = {
  fields: Pick<Fields, LinkKey>;
  errors: Partial<Record<string, string>>;
  onChange: (key: LinkKey, value: string) => void;
};

/** MF-08, MB-04: GitHub, LinkedIn and website, host-checked client-side and by the server. */
export function ProfileLinksFields({ fields, errors, onChange }: Props) {
  return (
    <>
      <FormField id="edit-github" label={t("editor.links.github")} error={errors["github"]}>
        {(c) => (
          <Input
            {...c}
            type="url"
            value={fields.github}
            onChange={(e) => onChange("github", e.target.value)}
          />
        )}
      </FormField>
      <FormField id="edit-linkedin" label={t("editor.links.linkedin")} error={errors["linkedin"]}>
        {(c) => (
          <Input
            {...c}
            type="url"
            value={fields.linkedin}
            onChange={(e) => onChange("linkedin", e.target.value)}
          />
        )}
      </FormField>
      <FormField id="edit-website" label={t("editor.links.website")} error={errors["website"]}>
        {(c) => (
          <Input
            {...c}
            type="url"
            value={fields.website}
            onChange={(e) => onChange("website", e.target.value)}
          />
        )}
      </FormField>
    </>
  );
}
