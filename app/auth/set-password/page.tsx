import { redirect } from "next/navigation";

import { SetPasswordForm } from "~/app/auth/set-password/set-password-form";
import { getServerAuthSession } from "~/server/auth";
import { getPasswordHashByUserId } from "~/server/auth/password";
import { db } from "~/server/db";

export default async function AuthSetPasswordPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=%2Fauth%2Fset-password");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
    },
  });

  if (!user?.email) {
    redirect("/");
  }

  const passwordHash = await getPasswordHashByUserId(session.user.id);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-4 text-white">
      <div className="w-full max-w-md">
        <SetPasswordForm
          email={user.email}
          hasPassword={Boolean(passwordHash)}
        />
      </div>
    </main>
  );
}
