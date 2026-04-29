'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AuditLogTable } from '@/components/admin/AuditLogTable';

interface AuditEntry {
  id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  data_json: string;
  created_at: string;
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    apiFetch<{ total: number; rows: AuditEntry[] }>('/admin/audit')
      .then(({ total, rows }) => { setTotal(total); setEntries(rows); })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <span className="text-sm text-gray-500">{total} total entries</span>
      </div>
      <AuditLogTable entries={entries} />
    </div>
  );
}
