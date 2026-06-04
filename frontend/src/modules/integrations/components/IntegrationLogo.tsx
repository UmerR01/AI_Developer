"use client";

import Image from "next/image";
import { useState } from "react";

export function IntegrationLogo({ logoKey }: { logoKey: string }) {
  const [failed, setFailed] = useState(false);
  const src = `/media/integrations/${logoKey}.svg`;

  if (failed) {
    return <div className="integration-logo-fallback" aria-hidden="true" />;
  }

  return <Image src={src} alt="" aria-hidden="true" width={32} height={32} onError={() => setFailed(true)} />;
}
