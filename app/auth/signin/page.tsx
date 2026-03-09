import { SignIn } from "~/app/_nodes/signin";
import { Suspense } from "react";

export default function AuthSignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-4 text-white">
      <div className="w-full max-w-md">
        <Suspense fallback={null}>
          <SignIn mini={false} />
        </Suspense>
      </div>
    </main>
  );
}
