export const metadata = { title: 'About · wstprtradio' };

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <h1 className="text-3xl font-bold text-white">About wstprtradio</h1>
      <div className="prose prose-invert prose-lg max-w-none text-gray-300 space-y-6">
        <p>
          wstprtradio is a community radio station that broadcasts 24/7 from the west port area.
          We play an eclectic mix of music across genres, with regular live DJ sets from local
          artists and special events.
        </p>
        <p>
          Our stream is powered by{' '}
          <a href="https://azuracast.com" className="text-indigo-400 hover:text-indigo-300">
            AzuraCast
          </a>{' '}
          for AutoDJ and live audio, with live video streamed via Cloudflare Stream.
        </p>
        <h2 className="text-xl font-semibold text-white">Get Involved</h2>
        <p>
          Interested in hosting a show? Reach out to us at{' '}
          <a href="mailto:hello@wstprtradio.com" className="text-indigo-400 hover:text-indigo-300">
            hello@wstprtradio.com
          </a>
        </p>
        <h2 className="text-xl font-semibold text-white">Technical</h2>
        <p>
          We broadcast at 128kbps MP3. Stream URL:{' '}
          <code className="bg-gray-800 px-1.5 py-0.5 rounded text-sm">
            https://radio.wstprtradio.com/radio.mp3
          </code>
        </p>
      </div>
    </div>
  );
}
