"use client";

import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
import { formatDateTime } from "@/lib/format";
import type { UserRecord, UserRole, WorkflowsResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const ROLE_STYLE: Record<UserRole, React.CSSProperties> = {
  admin: { background: "rgba(61,220,151,0.14)", color: "#3ddc97" },
  editor: { background: "rgba(91,157,255,0.14)", color: "#5b9dff" },
  viewer: { background: "rgba(255,255,255,0.06)", color: "#8a93a0" },
};

function ProjectsCell({ user, workflowNames }: { user: UserRecord; workflowNames: Map<number, string> }) {
  const { t } = useI18n();
  if (user.role === "admin") {
    return <span className="text-[12px] text-q-dim">{t("users.projectsAll")}</span>;
  }
  if (user.allowedWorkflows.length === 0) {
    return <span className="text-[12px] text-q-dim">{t("users.projectsNone")}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {user.allowedWorkflows.map((id) => (
        <span
          key={id}
          className="rounded-[5px] px-1.5 py-0.5 font-mono text-[10.5px] text-q-sub"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          {workflowNames.get(id) ?? `#${id}`}
        </span>
      ))}
    </div>
  );
}

export function UsersTable({
  users,
  onEdit,
  onDelete,
}: {
  users: UserRecord[];
  onEdit: (user: UserRecord) => void;
  onDelete: (user: UserRecord) => void;
}) {
  const { t } = useI18n();
  const { data: workflowsData } = useSWR<WorkflowsResponse>("/api/workflows", fetcher);
  const workflowNames = new Map((workflowsData?.workflows ?? []).map((w) => [w.id, w.name]));
  const roleLabel: Record<UserRole, string> = {
    admin: t("users.roleAdmin"),
    editor: t("users.roleEditor"),
    viewer: t("users.roleViewer"),
  };

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
        {t("users.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-panel">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">{t("users.username")}</th>
            <th className="px-4 py-3">{t("users.name")}</th>
            <th className="px-4 py-3">{t("users.role")}</th>
            <th className="px-4 py-3">{t("users.projects")}</th>
            <th className="px-4 py-3">{t("users.created")}</th>
            <th className="px-4 py-3 text-right">{t("users.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-surface-border last:border-0">
              <td className="px-4 py-3 font-mono text-xs text-q-text">{u.username}</td>
              <td className="px-4 py-3 text-gray-300">{u.name || "—"}</td>
              <td className="px-4 py-3">
                <span className="rounded-[6px] px-2 py-0.5 font-mono text-xs" style={ROLE_STYLE[u.role]}>
                  {roleLabel[u.role]}
                </span>
              </td>
              <td className="px-4 py-3">
                <ProjectsCell user={u} workflowNames={workflowNames} />
              </td>
              <td className="px-4 py-3 text-gray-500">{formatDateTime(u.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(u)}
                    className="rounded-[6px] px-2 py-1 font-mono text-[10.5px] font-medium text-q-dim transition hover:bg-surface-hover hover:text-q-text"
                  >
                    {t("users.edit")}
                  </button>
                  <button
                    onClick={() => onDelete(u)}
                    className="rounded-[6px] px-2 py-1 font-mono text-[10.5px] font-medium transition"
                    style={{ background: "rgba(255,93,93,0.08)", color: "#ff5d5d" }}
                  >
                    {t("users.delete")}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
