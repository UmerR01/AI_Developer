import "../../src/modules/dashboard/dashboard.css";
import "../../src/modules/settings/settings.css";
import { SettingsWorkspace } from "../../src/modules/settings/components/SettingsWorkspace";

type SettingsTab = "account" | "storage" | "subscription" | "team";

interface SettingsPageProps {
  searchParams?: { tab?: string };
}

export default function SettingsPage({ searchParams }: SettingsPageProps) {
  const tab = searchParams?.tab;
  const initialTab: SettingsTab =
    tab === "storage" || tab === "subscription" || tab === "team" ? tab : "account";

  return <SettingsWorkspace initialTab={initialTab} />;
}
