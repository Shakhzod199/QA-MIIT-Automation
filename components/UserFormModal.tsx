"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
import { CloseIcon } from "@/components/icons";
import type { UserRecord, UserRole, WorkflowsResponse } from "@/lib/types";

const INPUT_CLASS =
  "w-full rounded-[9px] border border-surface-border bg-surface-hover px-3 py-2 text-[13px] text-q-text placeholder:text-q-dim focus:outline-none";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function UserFormModal({
  user,
  onClose,
  onSubmit,
}: {
  /** Present = editing; absent = creating. */
  user?: UserRecord;
  onClose: () => void;
  onSubmit: (input: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    allowedWorkflows: number[];
  }) => Promise<string | void>;
}) {
  const { t } = useI18n();
  const isEdit = Boolean(user);
  // Admin sees every project regardless — this list is only for building the
  // editor/viewer picker below, so an admin editing another admin still gets
  // the full catalog to choose from once that user is demoted.
  const { data: workflowsData } = useSWR<WorkflowsResponse>("/api/workflows", fetcher);
  const workflows = workflowsData?.workflows ?? [];

  const [username, setUsername] = useState(user?.username ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(user?.role ?? "viewer");
  const [allowedWorkflows, setAllowedWorkflows] = useState<Set<number>>(
    new Set(user?.allowedWorkflows ?? [])
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const toggleWorkflow = (id: number) =>
    setAllowedWorkflows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const result = await onSubmit({
      username: username.trim(),
      password,
      name: name.trim(),
      role,
      allowedWorkflows: Array.from(allowedWorkflows),
    });
    setSaving(false);
    if (result) setError(result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-surface-border bg-surface-panel p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-sm font-semibold text-white">
            {isEdit ? t("users.editUser") : t("users.addUser")}
          </h3>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="shrink-0 rounded-md p-1 text-gray-500 transition hover:bg-surface-hover hover:text-gray-300"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-q-muted">{t("users.username")}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={INPUT_CLASS}
              disabled={isEdit}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-q-muted">{t("users.name")}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-q-muted">{t("users.role")}</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className={INPUT_CLASS}
            >
              <option value="admin">{t("users.roleAdmin")}</option>
              <option value="editor">{t("users.roleEditor")}</option>
              <option value="viewer">{t("users.roleViewer")}</option>
            </select>
          </div>

          {role === "admin" ? (
            <p className="rounded-[8px] border border-surface-border bg-surface-hover px-3 py-2 text-[12px] text-q-muted">
              {t("users.projectsAdminHint")}
            </p>
          ) : (
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-q-muted">{t("users.projects")}</label>
              <p className="mb-2 text-[11.5px] text-q-dim">{t("users.projectsHint")}</p>
              {workflows.length === 0 ? (
                <p className="text-[12px] text-q-dim">{t("users.projectsEmpty")}</p>
              ) : (
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-[9px] border border-surface-border bg-surface-hover p-2">
                  {workflows.map((wf) => (
                    <label
                      key={wf.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-[13px] text-q-text transition hover:bg-white/[0.03]"
                    >
                      <input
                        type="checkbox"
                        checked={allowedWorkflows.has(wf.id)}
                        onChange={() => toggleWorkflow(wf.id)}
                        className="h-[14px] w-[14px] shrink-0 cursor-pointer appearance-none rounded-[4px] border border-[rgba(255,255,255,0.2)] bg-transparent transition-colors checked:border-q-green checked:bg-q-green"
                      />
                      {wf.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-q-muted">{t("users.password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_CLASS}
              placeholder={isEdit ? t("users.passwordHint") : undefined}
              required={!isEdit}
            />
          </div>

          {error && (
            <p
              className="rounded-[8px] border px-3 py-2 text-[12.5px]"
              style={{ borderColor: "rgba(255,93,93,0.3)", background: "rgba(255,93,93,0.08)", color: "#ff5d5d" }}
            >
              {error}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[9px] px-4 py-2 text-[13px] font-medium text-q-muted transition hover:text-q-text"
            >
              {t("users.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[9px] px-4 py-2 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "#3ddc97", color: "#06140d" }}
            >
              {t("users.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
