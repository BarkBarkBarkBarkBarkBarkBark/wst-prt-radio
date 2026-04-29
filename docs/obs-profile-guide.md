# OBS Profile Guide — wstprtradio

Use OBS Studio to stream video + audio to wstprtradio for the live video experience.

## OBS Version

OBS Studio 29+ recommended. Download at https://obsproject.com

## Stream Settings

### Output Settings

1. Open OBS → **Settings → Stream**
2. **Service**: Custom
3. **Server**: `rtmp://live.cloudflarestream.com/` (or as provided by admin)
4. **Stream Key**: *(provided by admin from Cloudflare Stream)*

### Video Settings

1. **Settings → Video**
2. **Base Resolution**: 1920×1080
3. **Output Resolution**: 1280×720 (for bandwidth efficiency)
4. **FPS**: 30

### Output (Encoding) Settings

1. **Settings → Output → Streaming**
2. **Encoder**: x264 (or NVENC if you have Nvidia GPU)
3. **Rate Control**: CBR
4. **Bitrate**: 2500–4000 Kbps (depending on your upload speed)
5. **Keyframe Interval**: 2 seconds

### Audio Settings

1. **Settings → Audio**
2. **Sample Rate**: 44100 Hz
3. **Channels**: Stereo

## Recommended Scene Layout

Create scenes for:
- **DJ Booth**: Camera + music visualization
- **Screen Share**: Desktop capture for visual sets
- **Intermission**: Looping video / BRB screen

## Going Live

1. Press **Start Streaming** in OBS
2. Wait for the stream to connect (~5 seconds)
3. Verify on the wstprtradio admin panel that Cloudflare shows "connected"
4. Notify admin so they can create the live session entry
5. When done, press **Stop Streaming**

## Tips

- Do a test stream before going live (set a non-public stream key)
- Use a wired ethernet connection
- Monitor your upload speed — you need ~5 Mbps for 2500kbps + overhead
- Keep OBS and GPU drivers updated
