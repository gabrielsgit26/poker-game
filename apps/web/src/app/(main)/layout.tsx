import { MobileBottomNav } from "@/components/mobile-bottom-nav";

export default function MainShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1 pb-24 pt-4">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
