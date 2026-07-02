"use client";

// Legacy route. Each role now has its own home (/citizen, /officer, /authority,
// /admin). This just forwards whoever lands here to the right place.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, roleHome } from "@/lib/api";

export default function DashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    const u = getUser();
    router.replace(u ? roleHome(u.role) : "/login");
  }, [router]);
  return <main className="flex min-h-screen items-center justify-center bg-survey text-ink-soft">Taking you to your dashboard…</main>;
}
