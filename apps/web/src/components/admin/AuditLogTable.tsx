interface AuditEntry {
  id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  data_json: string;
  created_at: string;
}

interface AuditLogTableProps {
  entries: AuditEntry[];
}

export function AuditLogTable({ entries }: AuditLogTableProps) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {entries.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No audit entries yet</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3">When</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Entity</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <code className="text-indigo-300 text-xs">{e.action}</code>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {e.entity_type && <span>{e.entity_type}</span>}
                  {e.entity_id && <span className="ml-1 text-gray-600">#{e.entity_id.slice(0, 8)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
