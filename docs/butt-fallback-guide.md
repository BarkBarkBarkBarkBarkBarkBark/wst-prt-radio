# BUTT Fallback Guide — wstprtradio

BUTT (Broadcast Using This Tool) is a free, lightweight streaming client for Windows, macOS, and Linux. Use it when Web DJ is unavailable or when you need to stream from a DAW or mixer.

## Download

https://danielnoethen.de/butt/

## Configuration

### IceCast Settings

1. Open BUTT
2. Go to **Settings → Main**
3. Click **Add** under the Server list
4. Fill in:
   - **Type**: IceCast
   - **Address**: `radio.wstprtradio.com` (or your admin's server)
   - **Port**: `8000`
   - **Password**: *(ask admin for the source password)*
   - **Mount**: `/radio`
   - **Format**: MP3
   - **Quality/Bitrate**: 128 kbps
5. Click **Add**

### Audio Settings

1. Go to **Settings → Audio**
2. Select your audio device (microphone, interface, or virtual cable)
3. Set sample rate to **44100 Hz**
4. Set stereo (2 channels)

## Going Live

1. Press the big **Play** button in BUTT
2. Watch the connection status — it should say `connected`
3. Monitor the bitrate — should be steady around 128 kbps
4. Press **Stop** when done

## Streaming DAW Output

To stream from Ableton, Logic, etc.:
- **Windows**: Use VB-Cable or Voicemeeter as a virtual audio device
- **macOS**: Use BlackHole or Loopback
- Set BUTT audio input to the virtual cable output

## Troubleshooting

**Connection refused**: Check port 8000 is not blocked by your firewall

**Bad quality/dropouts**: Lower bitrate to 96kbps, check your upload speed

**"Mount already in use"**: Another streamer is connected — coordinate with the admin
