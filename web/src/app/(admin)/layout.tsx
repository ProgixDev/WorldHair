import { AdminAuthGuard } from "@/components/admin/AdminAuthGuard";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * Its own shell, deliberately not the marketing header/footer (TODO.md's
 * "## Admin" calls for exactly that split). Dark surfaces are written as
 * literal navy hex, the same way the landing's dark sections are — this app
 * has no `.dark` token block or theme provider any more.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthGuard>
      <div className="flex min-h-screen bg-[#17243a]">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </AdminAuthGuard>
  );
}
