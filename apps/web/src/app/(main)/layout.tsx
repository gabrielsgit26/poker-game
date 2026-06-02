import { MainShellLayoutClient } from "@/components/main-shell-layout-client";

export default function MainShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainShellLayoutClient>{children}</MainShellLayoutClient>;
}
