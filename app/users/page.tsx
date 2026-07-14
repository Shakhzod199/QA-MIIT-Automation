"use client";

import { useState } from "react";
import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
import { UsersTable } from "@/components/UsersTable";
import { UserFormModal } from "@/components/UserFormModal";
import { OnlineUsers } from "@/components/OnlineUsers";
import { VisitsChart } from "@/components/VisitsChart";
import type { UserRecord, UserResponse, UserRole, UsersResponse, VisitsResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function UsersPage() {
  const { t } = useI18n();
  const { data, mutate } = useSWR<UsersResponse>("/api/users", fetcher);
  const { data: visitsData } = useSWR<VisitsResponse>("/api/users/visits?days=7", fetcher);
  const [modal, setModal] = useState<"add" | UserRecord | null>(null);

  const users = data?.users ?? [];
  const visits = visitsData?.days ?? [];

  const handleCreate = async (input: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    allowedWorkflows: number[];
  }) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const result: UserResponse = await res.json();
    if (!result.ok) return result.error ?? "Failed to create user.";
    setModal(null);
    mutate();
  };

  const handleUpdate = async (
    id: number,
    input: { username: string; password: string; name: string; role: UserRole; allowedWorkflows: number[] }
  ) => {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        role: input.role,
        password: input.password || undefined,
        allowedWorkflows: input.allowedWorkflows,
      }),
    });
    const result: UserResponse = await res.json();
    if (!result.ok) return result.error ?? "Failed to update user.";
    setModal(null);
    mutate();
  };

  const handleDelete = async (user: UserRecord) => {
    if (!window.confirm(t("users.confirmDelete"))) return;
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    const result = await res.json();
    if (!result.ok) {
      window.alert(result.error ?? "Failed to delete user.");
      return;
    }
    mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-surface-border pb-5">
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-0.4px] text-q-text">{t("users.title")}</h2>
          <p className="mt-[3px] text-[12.5px] text-q-muted">{t("users.subtitle")}</p>
        </div>
        <button
          onClick={() => setModal("add")}
          className="rounded-[9px] px-4 py-2 text-[13px] font-bold transition"
          style={{ background: "#3ddc97", color: "#06140d" }}
        >
          {t("users.addUser")}
        </button>
      </div>

      <div>
        <h3 className="mb-3 text-[14px] font-semibold text-q-text">{t("users.onlineNow")}</h3>
        <p className="mb-3 -mt-2 text-[12px] text-q-muted">{t("users.onlineNowSubtitle")}</p>
        <OnlineUsers />
      </div>

      <div>
        <h3 className="mb-3 text-[14px] font-semibold text-q-text">{t("users.loginHistory")}</h3>
        <p className="mb-3 -mt-2 text-[12px] text-q-muted">{t("users.loginHistorySubtitle")}</p>
        <VisitsChart days={visits} />
      </div>

      <UsersTable users={users} onEdit={setModal} onDelete={handleDelete} />

      {modal === "add" && (
        <UserFormModal onClose={() => setModal(null)} onSubmit={handleCreate} />
      )}
      {modal && modal !== "add" && (
        <UserFormModal
          user={modal}
          onClose={() => setModal(null)}
          onSubmit={(input) => handleUpdate(modal.id, input)}
        />
      )}
    </div>
  );
}
