"use client";

import { useState } from "react";

export function IntegrationLogo({ logoKey }: { logoKey: string }) {
  const [failed, setFailed] = useState(false);
  const src = `/media/integrations/${logoKey}.svg`;

  if (failed) {
    return <div className="integration-logo-fallback" aria-hidden="true" />;
  }

  return <img src={src} alt="" aria-hidden="true" onError={() => setFailed(true)} />;
}
