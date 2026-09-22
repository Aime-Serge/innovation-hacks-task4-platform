import { useRef } from "react";
import { t } from "@/i18n";
import { AVATAR_ACCEPT, avatarFileProblem, isHttpsImageUrl, readAvatarFile } from "@/lib/avatar";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";

type Props = {
  avatarUrl: string | null;
  avatarError: string | undefined;
  onAvatarChange: (avatarUrl: string | null) => void;
  onAvatarError: (message: string | undefined) => void;
};

/** MF-01, ADR-426: an optional photo on step 2, a file upload or a link, not both at once. */
export function RegisterAvatarField({
  avatarUrl,
  avatarError,
  onAvatarChange,
  onAvatarError,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // A data: value came from a chosen file, not this field: show it empty rather than a huge
  // base64 string, and show anything else (including a link still being typed) as-is.
  const urlDraft = avatarUrl !== null && !avatarUrl.startsWith("data:") ? avatarUrl : "";

  const chooseFile = (file: File | undefined) => {
    if (file === undefined) return;
    const problem = avatarFileProblem(file);
    if (problem !== null) {
      onAvatarError(t(problem === "type" ? "auth.avatarInvalidType" : "auth.avatarTooLarge"));
      if (fileInputRef.current !== null) fileInputRef.current.value = "";
      return;
    }
    onAvatarError(undefined);
    // Read straight to the data: URL that gets submitted: the preview and the value are the
    // same string, so there is nothing to reconcile at submit time.
    void readAvatarFile(file).then(onAvatarChange);
  };

  const changeUrlText = (value: string) => {
    onAvatarError(undefined);
    if (value.trim() === "") {
      onAvatarChange(null);
      return;
    }
    onAvatarChange(value);
    if (fileInputRef.current !== null) fileInputRef.current.value = "";
  };

  const removePhoto = () => {
    onAvatarChange(null);
    onAvatarError(undefined);
    if (fileInputRef.current !== null) fileInputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line-strong p-3">
      <div className="flex items-center gap-3">
        <Avatar name="" avatarUrl={avatarUrl} size="lg" />
        <p className="text-sm text-muted">{t("auth.avatarHint")}</p>
      </div>
      <FormField id="reg-avatar-file" label={t("auth.avatarUpload")} error={avatarError}>
        {(c) => (
          <Input
            {...c}
            ref={fileInputRef}
            name="avatarFile"
            type="file"
            accept={AVATAR_ACCEPT}
            onChange={(e) => chooseFile(e.target.files?.[0])}
          />
        )}
      </FormField>
      <FormField id="reg-avatar-url" label={t("auth.avatarUrl")}>
        {(c) => (
          <Input
            {...c}
            name="avatarUrl"
            type="url"
            placeholder="https://…"
            value={urlDraft}
            onChange={(e) => changeUrlText(e.target.value)}
            onBlur={() => {
              if (urlDraft !== "" && !isHttpsImageUrl(urlDraft)) {
                onAvatarError(t("auth.avatarInvalidUrl"));
              }
            }}
          />
        )}
      </FormField>
      {(avatarUrl !== null || avatarError !== undefined) && (
        <Button type="button" size="sm" onClick={removePhoto} className="self-start">
          {t("auth.avatarRemove")}
        </Button>
      )}
    </div>
  );
}
