import { SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  const hasClerk =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder");

  if (!hasClerk) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-muted-foreground">
          Configure NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in your environment to enable sign-up.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
