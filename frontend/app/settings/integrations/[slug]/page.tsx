import "../../../../src/modules/dashboard/dashboard.css";
import "../../../../src/modules/settings/settings.css";
import "../../../../src/modules/integrations/integrations.css";
import { IntegrationsWorkspace } from "../../../../src/modules/integrations/components/IntegrationsWorkspace";

interface IntegrationSlugPageProps {
  params: { slug: string };
}

export default function IntegrationSlugPage({ params }: IntegrationSlugPageProps) {
  return <IntegrationsWorkspace initialSlug={params.slug} />;
}