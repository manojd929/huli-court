import { DashboardThemeShell } from "@/features/dashboard/dashboard-theme-shell";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardThemeShell>{children}</DashboardThemeShell>;
}
