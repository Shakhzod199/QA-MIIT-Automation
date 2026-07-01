import { NextResponse } from "next/server";
import { deleteUser, updateUser } from "@/lib/users";
import type { UpdateUserRequest, UserResponse } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as UpdateUserRequest;

  try {
    const user = await updateUser(Number(id), {
      name: body.name?.trim(),
      role: body.role,
      password: body.password || undefined,
    });
    return NextResponse.json<UserResponse>({ ok: true, user });
  } catch (err) {
    return NextResponse.json<UserResponse>(
      { ok: false, error: err instanceof Error ? err.message : "Failed to update user." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await deleteUser(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to delete user." },
      { status: 400 }
    );
  }
}
