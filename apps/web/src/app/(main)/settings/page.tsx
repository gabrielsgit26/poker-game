import { SettingsForm } from "@/features/settings/settings-form";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="px-4 pt-2 text-2xl font-semibold text-zinc-50">Settings</h1>
      <p className="mt-1 px-4 text-sm text-zinc-500">
        Sound, table theme, and other client-only preferences.
      </p>
      <SettingsForm />
    </div>
  );
}
