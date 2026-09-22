"use client";

import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { t } from "@/i18n";
import type { Me } from "@/schemas";
import { ServiceError } from "@/services/types";
import { Button } from "@/ui/Button";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { useChangePassword, useDeleteAccount, useSignOutAllDevices } from "../data/hooks";

/** MF-13, MF-14, MF-17: password change, sign out everywhere, and account deletion. */
export function AccountTab({ me }: { me: Me }) {
  const { logout } = useAuth();
  const changePassword = useChangePassword();
  const signOutAll = useSignOutAllDevices();
  const deleteAccount = useDeleteAccount();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);

  const [signOutOpen, setSignOutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const submitPassword = async () => {
    setPasswordError(null);
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setPasswordDone(true);
      // The current session cannot be kept alive from the browser (no reachable refresh
      // token outside /api/bff/auth, ADR-425): changing the password signs everyone out.
      await logout();
    } catch (failure) {
      if (failure instanceof ServiceError && failure.status === 403) {
        setPasswordError(t("settings.account.wrongPassword"));
      } else if (failure instanceof ServiceError && failure.details?.[0]) {
        setPasswordError(failure.details[0].message);
      } else {
        setPasswordError(t("form.saveFailed"));
      }
    }
  };

  const confirmSignOutAll = async () => {
    await signOutAll.mutateAsync();
    await logout();
  };

  const confirmDelete = async () => {
    setDeleteError(null);
    try {
      await deleteAccount.mutateAsync(deletePassword);
      await logout();
    } catch (failure) {
      if (failure instanceof ServiceError && failure.code === "USER_OWNS_PROJECTS") {
        setDeleteError(t("settings.account.deleteOwnsProjects"));
      } else if (failure instanceof ServiceError && failure.status === 403) {
        setDeleteError(t("settings.account.wrongPassword"));
      } else {
        setDeleteError(t("form.saveFailed"));
      }
    }
  };

  return (
    <div className="flex max-w-md flex-col gap-8">
      <FormField id="account-email" label={t("settings.account.email")}>
        {(c) => <Input {...c} value={me.email ?? ""} readOnly disabled />}
      </FormField>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitPassword();
        }}
        noValidate
        className="flex flex-col gap-4"
      >
        <h2 className="text-base font-semibold">{t("settings.account.changePassword")}</h2>
        {passwordDone && <p role="status">{t("settings.account.passwordChanged")}</p>}
        <FormField
          id="current-password"
          label={t("settings.account.currentPassword")}
          error={passwordError}
        >
          {(c) => (
            <Input
              {...c}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          )}
        </FormField>
        <FormField id="new-password" label={t("settings.account.newPassword")}>
          {(c) => (
            <Input
              {...c}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          )}
        </FormField>
        <div>
          <Button type="submit" variant="primary" disabled={changePassword.isPending}>
            {changePassword.isPending ? t("common.saving") : t("settings.account.changePassword")}
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("settings.account.signOutAll")}</h2>
        <p className="text-sm text-muted">{t("settings.account.signOutAllBody")}</p>
        <div>
          <Button variant="secondary" onClick={() => setSignOutOpen(true)}>
            {t("settings.account.signOutAll")}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title={t("settings.account.signOutAll")}
        body={t("settings.account.signOutAllBody")}
        confirmLabel={t("settings.account.signOutAllConfirm")}
        busy={signOutAll.isPending}
        onConfirm={() => void confirmSignOutAll()}
      />

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-danger">
          {t("settings.account.deleteAccount")}
        </h2>
        <p className="text-sm text-muted">{t("settings.account.deleteBody")}</p>
        <div>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            {t("settings.account.deleteAccount")}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("settings.account.deleteAccount")}
        body={t("settings.account.deleteBody")}
        confirmLabel={t("settings.account.deleteConfirm")}
        busy={deleteAccount.isPending}
        onConfirm={() => void confirmDelete()}
        problem={
          <div className="flex flex-col gap-2 text-left">
            {deleteError !== null && <p>{deleteError}</p>}
            <FormField id="delete-password" label={t("settings.account.deletePassword")}>
              {(c) => (
                <Input
                  {...c}
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
              )}
            </FormField>
          </div>
        }
      />
    </div>
  );
}
