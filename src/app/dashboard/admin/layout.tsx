/** Pass-through — auth + redirect handled in page.tsx */
export default function DashboardAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
