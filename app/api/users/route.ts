import { NextResponse } from "next/server";
import { createUser, listUsers } from "@/lib/users";
import type { CreateUserRequest, UserResponse, UsersResponse } from "@/lib/types";

export async function GET() {
  return NextResponse.json<UsersResponse>({ ok: true, users: await listUsers() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateUserRequest;

  if (!body.username?.trim() || !body.password || !body.role) {
    return NextResponse.json<UserResponse>(
      { ok: false, error: "Username, password, and role are required." },
      { status: 400 }
    );
  }

  try {
    const user = await createUser({
      username: body.username.trim(),
      password: body.password,
      name: body.name?.trim() || undefined,
      role: body.role,
      allowedWorkflows: body.allowedWorkflows,
    });
    return NextResponse.json<UserResponse>({ ok: true, user }, { status: 201 });
  } catch (err) {
    return NextResponse.json<UserResponse>(
      { ok: false, error: err instanceof Error ? err.message : "Failed to create user." },
      { status: 400 }
    );
  }
}
