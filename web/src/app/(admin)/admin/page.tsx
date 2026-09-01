import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { AdminCapabilityCards } from "@/components/admin/dashboard/AdminCapabilityCards";
import { AdminQueueRail } from "@/components/admin/dashboard/AdminQueueRail";
import { BookingsChart } from "@/components/admin/dashboard/BookingsChart";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tableau de bord — Admin WorldHair",
};

export default function AdminDashboardPage() {
  return (
    <>
      <AdminTopBar title="Tableau de bord" />

      {/* The rail sits beside the dashboard rather than in the shell: the
          queue pages that come next are table-heavy and want the full width. */}
      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <div className="min-w-0 flex-1 px-6 pt-4 pb-8 sm:px-8">
          {/* One shared surface for the whole dashboard cluster — no
              per-section borders inside it, only background-tone steps.
              #080f1a is mobile's own base "background" token (constants/
              themes.ts) — a real elevation step, not a value picked to taste. */}
          <div className="flex flex-col gap-6 rounded-3xl bg-[#080f1a] p-5 sm:p-6">
            <BookingsChart />
            <AdminCapabilityCards />
          </div>
        </div>

        <AdminQueueRail />
      </div>
    </>
  );
}
