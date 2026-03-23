#!/bin/sh
set -eu

SERVER_NAME="${NGINX_SERVER_NAME:-_}"
SSL_CERT_PATH="${NGINX_SSL_CERT_PATH:-/etc/nginx/certs/tls.crt}"
SSL_KEY_PATH="${NGINX_SSL_KEY_PATH:-/etc/nginx/certs/tls.key}"
ENABLE_HTTPS="${NGINX_ENABLE_HTTPS:-true}"

TEMPLATE="/etc/nginx/openroster/default.http.conf"

if [ "$ENABLE_HTTPS" != "false" ] && [ -f "$SSL_CERT_PATH" ] && [ -f "$SSL_KEY_PATH" ]; then
  TEMPLATE="/etc/nginx/openroster/default.https.conf"
fi

sed \
  -e "s|__SERVER_NAME__|$SERVER_NAME|g" \
  -e "s|__SSL_CERT_PATH__|$SSL_CERT_PATH|g" \
  -e "s|__SSL_KEY_PATH__|$SSL_KEY_PATH|g" \
  "$TEMPLATE" > /etc/nginx/conf.d/default.conf
