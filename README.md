# wst-prt-spec_version: "1.0"

project:
  name: "wstprtradio"
  objective: >
    Build an always-on radio website with a public listener experience, an authenticated admin
    experience, a small control backend, an AutoDJ/live takeover station backend, and a v1.0
    architecture that is multicast-ready for live video events.
  hard_requirements:
    - "Public frontend hosted on Vercel"
    - "Small control backend hosted on Fly.io"
    - "Always-on station backend using AzuraCast"
    - "No localhost or terminal required for the operator during normal use"
    - "Live takeover must fall back to always-on playlist automatically"
    - "Architecture must be ready for multicast streaming in v1.0"
  explicit_decisions:
    station_backend: "AzuraCast"
    fallback_broadcaster_client: "BUTT"
    live_video_fanout: "Cloudflare Stream"
    public_frontend: "Next.js on Vercel"
    control_backend: "Fastify on Fly.io"
    database: "SQLite on Fly volume"
    monorepo: true
    package_manager: "pnpm"
    language: "TypeScript"
  do_not_do:
    - "Do not use BUTT as the backend"
    - "Do not use Discord as the primary ingest or switching layer"
    - "Do not use Tailscale in the media path for public listeners"
    - "Do not host the media plane on Vercel"
    - "Do not block implementation on TikTok automation"
    - "Do not ask for further architecture decisions; implement this spec as written"

success_definition:
  - "Listeners can always hear the station from the public site"
  - "Admin can see whether station is in AutoDJ or live mode"
  - "Admin can open the live broadcast workflow without terminal use"
  - "If live audio ends, station returns to AutoDJ automatically"
  - "Public site switches to live video state when a live video event is active"
  - "Admin can configure and enable multicast destinations"
  - "Twitch and Instagram are first-class destinations"
  - "TikTok is implemented behind a feature flag with explicit unsupported/degraded handling"
  - "Discord is implemented as a community notification destination, not a media output"

architecture:
  style: "control-plane + media-plane"
  media_plane:
    azuracast:
      role: "24/7 radio output, AutoDJ, live audio takeover, metadata source"
      deployment_target: "single VM outside Fly/Vercel"
      exposure:
        public_stream_subdomain: "radio.wstprtradio.com"
        admin_subdomain: "azura-admin.wstprtradio.com"
      notes:
        - "Use AzuraCast station for always-on playlist"
        - "Enable live streamers/DJs"
        - "Use Web DJ for browser-based live audio"
        - "Support BUTT as fallback encoder"
    cloudflare_stream:
      role: "live video ingest, live status, simulcast fanout"
      ingestion_modes:
        - "RTMPS"
        - "SRT"
      outputs:
        - "Twitch"
        - "Instagram"
        - "Custom RTMP"
        - "Custom SRT"
        - "TikTok experimental"
  control_plane:
    api:
      role: "auth, admin actions, station state aggregation, destination management, webhooks"
      deployment_target: "Fly.io"
      persistence: "SQLite on Fly volume"
    web:
      role: "public site + admin UI"
      deployment_target: "Vercel"
      integration: "calls Fly.io API only; no direct secret use in browser"

domains:
  public_site: "wstprtradio.com"
  admin_site: "admin.wstprtradio.com"
  api_site: "api.wstprtradio.com"
  radio_stream: "radio.wstprtradio.com"
  azuracast_admin: "azura-admin.wstprtradio.com"

repo:
  strategy: "single monorepo"
  structure:
    - "apps/web                # Next.js Vercel app"
    - "apps/api                # Fastify Fly.io app"
    - "packages/shared         # types, schemas, helpers"
    - "packages/ui             # shared UI components"
    - "infra/azuracast         # deployment notes, env templates, reverse proxy examples"
    - "infra/fly               # fly.toml, deploy scripts"
    - "infra/vercel            # vercel.json, env docs"
    - "docs                    # runbooks and operator docs"

frontend:
  framework: "Next.js App Router"
  styling: "Tailwind CSS"
  routes:
    public:
      - "/"
      - "/listen"
      - "/schedule"
      - "/live"
      - "/about"
    admin:
      - "/admin"
      - "/admin/station"
      - "/admin/live"
      - "/admin/destinations"
      - "/admin/settings"
      - "/admin/audit"
  public_features:
    - "Persistent audio player using AzuraCast public stream URL"
    - "Now playing card"
    - "Live badge when live DJ or live video is active"
    - "Listener count"
    - "Recent tracks"
    - "Live event hero when live video is active"
    - "Graceful fallback to audio-only mode"
  admin_features:
    - "Email/password login"
    - "Single-screen station status dashboard"
    - "Current mode: autodj | live_audio | live_video | degraded"
    - "Open Web DJ button"
    - "Open BUTT setup/download page"
    - "Create live video session"
    - "View ingest URL/key for OBS"
    - "Manage multicast destinations"
    - "Enable/disable destinations"
    - "Test destination connectivity"
    - "Audit trail viewer"
  ui_requirements:
    - "Large obvious buttons for non-technical operator"
    - "No admin action requires terminal"
    - "No admin action requires localhost"
    - "Use explicit labels instead of jargon"
    - "Show degraded/unsupported state clearly"

backend:
  framework: "Fastify"
  runtime: "Node.js LTS"
  responsibilities:
    - "Authentication and session management"
    - "Aggregate station state from AzuraCast + Cloudflare"
    - "Store destination configs securely"
    - "Receive and process webhooks"
    - "Expose public status endpoints"
    - "Expose admin control endpoints"
    - "Encrypt provider secrets at rest"
  security:
    auth:
      method: "email/password"
      hashing: "argon2id"
      session: "httpOnly secure cookie"
    encryption:
      method: "symmetric encryption using BACKEND_ENCRYPTION_KEY"
    cors:
      allowed_origins:
        - "https://wstprtradio.com"
        - "https://admin.wstprtradio.com"
    rate_limits:
      - "auth endpoints"
      - "webhook endpoints"
      - "admin mutation endpoints"

database:
  engine: "SQLite"
  tables:
    users:
      columns:
        - "id"
        - "email"
        - "password_hash"
        - "role"
        - "created_at"
        - "updated_at"
    station_settings:
      columns:
        - "id"
        - "station_name"
        - "azuracast_base_url"
        - "azuracast_public_stream_url"
        - "azuracast_public_api_url"
        - "azuracast_api_key_encrypted"
        - "cloudflare_account_id"
        - "cloudflare_live_input_id"
        - "cloudflare_api_token_encrypted"
        - "default_stream_mode"
        - "created_at"
        - "updated_at"
    destinations:
      columns:
        - "id"
        - "kind"
        - "name"
        - "enabled"
        - "url"
        - "stream_key_encrypted"
        - "srt_passphrase_encrypted"
        - "metadata_json"
        - "sort_order"
        - "created_at"
        - "updated_at"
    live_sessions:
      columns:
        - "id"
        - "mode"
        - "title"
        - "description"
        - "status"
        - "started_at"
        - "ended_at"
        - "initiated_by_user_id"
        - "cloudflare_live_input_id"
        - "azuracast_streamer_name"
        - "notes_json"
    webhook_events:
      columns:
        - "id"
        - "source"
        - "event_type"
        - "payload_json"
        - "received_at"
        - "processed_at"
        - "status"
    audit_log:
      columns:
        - "id"
        - "actor_user_id"
        - "action"
        - "entity_type"
        - "entity_id"
        - "data_json"
        - "created_at"

integrations:
  azuracast:
    required_capabilities:
      - "Read public now-playing data"
      - "Detect live DJ connected state"
      - "Deep-link operator to Web DJ page"
      - "Support DJ credentials for BUTT fallback"
    backend_service_name: "azuracastService"
    implementation_rules:
      - "Poll now-playing endpoint every 10 seconds as fallback"
      - "Normalize station status into internal state machine"
      - "Do not attempt to re-implement AzuraCast AutoDJ"
  cloudflare_stream:
    required_capabilities:
      - "Create or manage one live input"
      - "Read live input status"
      - "Create/update/delete outputs"
      - "Receive live webhooks"
    backend_service_name: "cloudflareStreamService"
    implementation_rules:
      - "One canonical live input for v1.0"
      - "Use outputs for fanout destinations"
      - "Reflect live input state into public/admin status"
  butt:
    role: "fallback desktop broadcaster client"
    implementation_rules:
      - "Do not build BUTT into the backend"
      - "Provide a setup page with downloadable configuration instructions"
      - "Document exact Icecast-style connection settings"
  obs:
    role: "video event broadcaster"
    implementation_rules:
      - "Assume one preconfigured OBS profile for live video"
      - "Admin UI must show ingest target and current connection status"
      - "No custom OBS plugin development in v1.0"

destination_policy:
  supported_now:
    - kind: "twitch"
      output_mode: "cloudflare_output"
      admin_status: "supported"
    - kind: "instagram"
      output_mode: "cloudflare_output"
      admin_status: "supported"
    - kind: "custom_rtmp"
      output_mode: "cloudflare_output"
      admin_status: "supported"
    - kind: "custom_srt"
      output_mode: "cloudflare_output"
      admin_status: "supported"
  experimental:
    - kind: "tiktok_experimental"
      output_mode: "cloudflare_output_or_manual_key"
      admin_status: "experimental"
      ui_copy: "Requires account/provider workflow that yields usable live stream credentials"
  not_media_outputs:
    - kind: "discord_notify"
      output_mode: "notification_only"
      admin_status: "supported"
      ui_copy: "Discord is used for go-live notification, not direct media ingest/output"
  forbidden_assumptions:
    - "Do not assume TikTok can always be auto-provisioned"
    - "Do not assume Discord can be treated as RTMP output"

state_machine:
  states:
    - "autodj"
    - "live_audio"
    - "live_video"
    - "degraded"
  transitions:
    - from: "autodj"
      to: "live_audio"
      when: "AzuraCast reports live DJ connected"
    - from: "autodj"
      to: "live_video"
      when: "Cloudflare live input connected and active session exists"
    - from: "live_audio"
      to: "autodj"
      when: "AzuraCast reports no live DJ connected"
    - from: "live_video"
      to: "autodj"
      when: "Cloudflare live input disconnected and no live DJ connected"
    - from: "live_video"
      to: "live_audio"
      when: "Video input disconnected but live DJ remains connected"
    - from: "*"
      to: "degraded"
      when: "Upstream provider unavailable or required config missing"

api:
  public_endpoints:
    - "GET /health"
    - "GET /public/status"
    - "GET /public/now-playing"
    - "GET /public/live-session"
  admin_endpoints:
    - "POST /auth/login"
    - "POST /auth/logout"
    - "GET /admin/me"
    - "GET /admin/dashboard"
    - "GET /admin/station/status"
    - "POST /admin/live/audio/open-web-dj-link"
    - "POST /admin/live/video/session"
    - "POST /admin/live/video/end"
    - "GET /admin/destinations"
    - "POST /admin/destinations"
    - "PATCH /admin/destinations/:id"
    - "POST /admin/destinations/:id/test"
    - "DELETE /admin/destinations/:id"
    - "GET /admin/settings"
    - "PATCH /admin/settings"
    - "GET /admin/audit"
  webhook_endpoints:
    - "POST /webhooks/cloudflare-stream"
    - "POST /webhooks/azuracast"

operator_workflows:
  audio_live_show:
    steps:
      - "Operator logs into admin.wstprtradio.com"
      - "Operator sees current station status"
      - "Operator clicks Open Web DJ"
      - "Operator broadcasts from browser"
      - "Backend/public site show live status automatically"
      - "When operator ends broadcast, station returns to AutoDJ"
  audio_live_show_fallback:
    steps:
      - "Operator opens BUTT"
      - "Operator uses preconfigured station profile"
      - "Operator clicks Play/Start"
      - "AzuraCast takes over and public site shows live state"
  video_live_event:
    steps:
      - "Admin creates a live video session in admin UI"
      - "Admin copies or views RTMPS/SRT ingest target"
      - "Operator starts preconfigured OBS profile"
      - "Cloudflare live input connects"
      - "Public site switches to live video hero/player"
      - "Configured outputs fan out to enabled destinations"
      - "When video ends, site falls back to audio station"

environment_variables:
  shared:
    - "APP_ENV"
    - "APP_BASE_URL"
  web:
    - "NEXT_PUBLIC_API_BASE_URL"
    - "NEXT_PUBLIC_PUBLIC_SITE_URL"
  api:
    - "PORT"
    - "SESSION_SECRET"
    - "BACKEND_ENCRYPTION_KEY"
    - "SQLITE_DB_PATH"
    - "ADMIN_SEED_EMAIL"
    - "ADMIN_SEED_PASSWORD"
    - "AZURACAST_BASE_URL"
    - "AZURACAST_PUBLIC_STREAM_URL"
    - "AZURACAST_PUBLIC_API_URL"
    - "AZURACAST_API_KEY"
    - "CLOUDFLARE_ACCOUNT_ID"
    - "CLOUDFLARE_STREAM_API_TOKEN"
    - "CLOUDFLARE_LIVE_INPUT_ID"
    - "DISCORD_WEBHOOK_URL"
  notes:
    - "Do not expose provider secrets to the frontend"

implementation_order:
  - id: 1
    name: "Bootstrap monorepo"
    deliverables:
      - "pnpm workspace"
      - "apps/web"
      - "apps/api"
      - "shared packages"
      - "linting, formatting, env validation"
  - id: 2
    name: "Implement API foundation"
    deliverables:
      - "Fastify server"
      - "SQLite schema + migrations"
      - "seed admin user"
      - "session auth"
      - "encryption helpers"
      - "health endpoint"
  - id: 3
    name: "Implement AzuraCast integration"
    deliverables:
      - "now-playing polling service"
      - "station status normalizer"
      - "Web DJ deep-link support"
      - "public stream config"
  - id: 4
    name: "Implement Cloudflare Stream integration"
    deliverables:
      - "live input status reader"
      - "destination CRUD"
      - "output sync logic"
      - "webhook receiver"
  - id: 5
    name: "Build public frontend"
    deliverables:
      - "homepage"
      - "persistent player"
      - "now playing"
      - "live badge"
      - "live event surface"
  - id: 6
    name: "Build admin frontend"
    deliverables:
      - "login screen"
      - "dashboard"
      - "live controls"
      - "destination management UI"
      - "settings page"
      - "audit log page"
  - id: 7
    name: "Implement state-driven UX"
    deliverables:
      - "frontend polling or SSE from API"
      - "public mode switching"
      - "degraded state banners"
  - id: 8
    name: "Deployment configs"
    deliverables:
      - "vercel config"
      - "fly.toml"
      - "Fly volume instructions"
      - "AzuraCast deployment docs"
      - "DNS checklist"
  - id: 9
    name: "Operator docs"
    deliverables:
      - "one-page musician guide"
      - "Web DJ guide"
      - "BUTT fallback guide"
      - "OBS profile guide"
  - id: 10
    name: "Smoke tests"
    deliverables:
      - "public player works"
      - "admin login works"
      - "AzuraCast live detection works"
      - "Cloudflare live detection works"
      - "Twitch/Instagram output test path works"

testing:
  automated:
    - "unit tests for state normalization"
    - "unit tests for encryption helpers"
    - "API integration tests with mocked AzuraCast/Cloudflare responses"
    - "frontend component tests for player and admin state"
  manual:
    - "AutoDJ plays from public site"
    - "Live DJ connection flips state within 10 seconds"
    - "Disconnect live DJ returns to AutoDJ"
    - "Starting OBS live event shows live video state"
    - "Twitch destination receives feed"
    - "Instagram destination receives feed if valid credentials are configured"
    - "Discord notification fires on go-live"
    - "TikTok destination shows experimental state unless fully configured"

deployment:
  vercel:
    tasks:
      - "Deploy apps/web"
      - "Configure production env vars"
      - "Attach wstprtradio.com and admin.wstprtradio.com"
  fly_io:
    tasks:
      - "Deploy apps/api"
      - "Create one volume"
      - "Attach api.wstprtradio.com"
      - "Set secrets"
      - "Keep single primary machine in one region for v1.0"
  azuracast:
    tasks:
      - "Deploy AzuraCast on dedicated VM"
      - "Create station"
      - "Enable AutoDJ"
      - "Upload playlist media"
      - "Enable streamers/DJs"
      - "Create Web DJ-capable operator account"
      - "Set public stream/mount URLs"
  cloudflare_stream:
    tasks:
      - "Create one live input"
      - "Store live input id in backend"
      - "Enable webhook notifications"
      - "Wire destination outputs from admin UI"

acceptance_criteria:
  - "A listener can open the public site and immediately hear the station"
  - "Admin can log in and see real-time station mode"
  - "Admin can start a live audio workflow without terminal or localhost"
  - "AutoDJ resumes automatically after live audio ends"
  - "Admin can configure Twitch and Instagram destinations from the UI"
  - "Public site shows live video event when Cloudflare input is connected"
  - "System never falsely labels Discord as a direct stream output"
  - "System never blocks deployment on TikTok automation availability"

agent_execution_rules:
  - "Execute tasks in implementation_order sequence"
  - "Create working code, configs, and docs; do not stop at planning"
  - "Use environment-driven configuration everywhere"
  - "Prefer simple, boring implementations over clever abstractions"
  - "Commit each implementation_order item separately if working in git"
  - "If an external integration cannot be completed locally, scaffold it fully and document exact remaining secrets/setup"
  - "Do not redesign the architecture"

