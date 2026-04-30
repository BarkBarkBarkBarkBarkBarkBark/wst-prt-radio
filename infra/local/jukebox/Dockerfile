FROM savonet/liquidsoap:v2.3.3

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends gettext-base curl \
  && rm -rf /var/lib/apt/lists/*

COPY liquidsoap.liq.template /etc/liquidsoap/radio.liq.template
COPY docker-entrypoint.sh /usr/local/bin/jukebox-entrypoint.sh

RUN chmod +x /usr/local/bin/jukebox-entrypoint.sh \
  && mkdir -p /music /tmp/liquidsoap \
  && chown -R liquidsoap:liquidsoap /music /tmp/liquidsoap

USER liquidsoap

ENTRYPOINT ["/usr/local/bin/jukebox-entrypoint.sh"]
