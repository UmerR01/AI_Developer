import "../../../src/modules/dashboard/dashboard.css";
import "../../../src/modules/settings/settings.css";
import { SettingsWorkspace } from "../../../src/modules/settings/components/SettingsWorkspace";

export default function SubscriptionPage() {
  return <SettingsWorkspace initialTab="subscription" />;
}
