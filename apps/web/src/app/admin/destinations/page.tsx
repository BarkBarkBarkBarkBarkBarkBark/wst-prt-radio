'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { DestinationsTable } from '@/components/admin/DestinationsTable';
import type { Destination } from '@wstprtradio/shared';

export default function AdminDestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);

  const reload = () =>
    apiFetch<Destination[]>('/admin/destinations').then(setDestinations).catch(console.error);

  useEffect(() => { void reload(); }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Destinations</h1>
      <DestinationsTable destinations={destinations} onRefresh={() => void reload()} />
    </div>
  );
}
