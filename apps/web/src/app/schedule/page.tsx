export const metadata = { title: 'Schedule · wstprtradio' };

export default function SchedulePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <h1 className="text-3xl font-bold text-white">Schedule</h1>
      <p className="text-gray-400">
        Weekly programming schedule coming soon. Follow us on social media for show announcements.
      </p>
      <div className="grid gap-4">
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
          (day) => (
            <div key={day} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold text-white mb-2">{day}</h2>
              <p className="text-gray-500 text-sm">AutoDJ — continuous music</p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
