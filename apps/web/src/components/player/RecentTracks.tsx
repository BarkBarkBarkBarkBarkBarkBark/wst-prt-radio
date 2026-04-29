'use client';

export function RecentTracks() {
  // In v1 we don't have a recent tracks endpoint, but the component is ready for it
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
      <h2 className="text-base font-semibold text-white mb-4">Recent Tracks</h2>
      <p className="text-sm text-gray-500">Track history will appear here once enough songs have played.</p>
    </div>
  );
}
