"use client";

// Legacy route — the officer queue moved into the officer console (/officer).
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function QueueRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/officer"); }, [router]);
  return <main className="flex min-h-screen items-center justify-center bg-survey text-ink-soft">Redirecting…</main>;
}
