#!/usr/bin/env bash
# Registers app_dashingarrivals, this site's Substratal Application, so
# visitors can sign in with a Substratal account and save their theme,
# Top 5 Routes, and stops. Run it once as the Substratal superadmin (staff
# registration is what allows the site's own sign-in form); running it again
# brings app_dashingarrivals back to these settings.
#
#   scripts/register-dashingarrivals.sh                  # production
#   scripts/register-dashingarrivals.sh webhook          # after the site is deployed
#   SUBSTRATAL_API=http://localhost:8080 scripts/register-dashingarrivals.sh
#
# It asks for the superadmin's password and current two-factor code, so
# nothing secret lands in shell history. With TOKEN set it skips sign-in.
set -euo pipefail

API="${SUBSTRATAL_API:-https://api.substratalapps.com}"
EMAIL="${SUPERADMIN_EMAIL:-adronhall@substratalapps.com}"
SITE="${SITE_URL:-https://dashingarrivals.com}"
APP_ID="app_dashingarrivals"
VERSION="Substratal-Version: 1"
need() { command -v "$1" >/dev/null || { echo "register-dashingarrivals: $1 is required" >&2; exit 1; }; }
need curl
need jq

post() { # path json
  curl -sS -X POST "$API$1" -H "$VERSION" -H "Content-Type: application/json" -d "$2" -w '\n%{http_code}'
}
call() { # method path [json]
  local args=(-sS -X "$1" "$API$2" -H "$VERSION" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -w '\n%{http_code}')
  [[ -n "${3:-}" ]] && args+=(-d "$3")
  [[ "$1" == POST ]] && args+=(-H "Idempotency-Key: register-dashingarrivals-$(uuidgen 2>/dev/null || date +%s%N)")
  local out; out=$(curl "${args[@]}")
  STATUS=${out##*$'\n'}; BODY=${out%$'\n'*}
}
fail() { echo "register-dashingarrivals: $*" >&2; exit 1; }
step() { printf '\n== %s\n' "$*"; }

signed_in_here=false
if [[ -z "${TOKEN:-}" ]]; then
  step "Sign in as $EMAIL"
  printf 'Password: '; IFS= read -rs PW; echo
  out=$(post /auth/login "$(jq -n --arg e "$EMAIL" --arg p "$PW" '{email:$e,password:$p}')"); unset PW
  STATUS=${out##*$'\n'}; BODY=${out%$'\n'*}
  [[ "$STATUS" == 200 ]] || fail "login: HTTP $STATUS: $BODY"
  if [[ $(jq -r '.mfa_required // false' <<<"$BODY") == true ]]; then
    MFA=$(jq -r .mfa_token <<<"$BODY")
    printf 'Two-factor code: '; IFS= read -r CODE
    out=$(post /auth/mfa/verify "$(jq -n --arg t "$MFA" --arg c "$CODE" '{mfa_token:$t,code:$c}')")
    STATUS=${out##*$'\n'}; BODY=${out%$'\n'*}
    [[ "$STATUS" == 200 ]] || fail "two-factor: HTTP $STATUS: $BODY"
  fi
  TOKEN=$(jq -r .access_token <<<"$BODY")
  signed_in_here=true
fi
logout() {
  if $signed_in_here; then
    curl -sS -o /dev/null -X POST "$API/auth/logout" -H "$VERSION" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
  fi
}
trap logout EXIT

# webhook: subscribe the deployed site to the events Substratal's trust model
# asks every Application to handle. Prints the signing secret once — put it
# in Vercel as SUBSTRATAL_WEBHOOK_SECRET and redeploy.
if [[ "${1:-}" == webhook ]]; then
  step "Subscribe $SITE/api/substratal/webhook"
  call POST /webhooks "$(jq -n --arg app "$APP_ID" --arg url "$SITE/api/substratal/webhook" '{
    scope: $app, url: $url, events: ["access.revoked", "role.removed"],
    description: "Dashing Arrivals production listener"
  }')"
  [[ "$STATUS" == 201 ]] || fail "create webhook: HTTP $STATUS: $BODY"
  jq '{id, url, events}' <<<"$BODY"
  echo
  echo "Signing secret (shown once): $(jq -r .signing_secret <<<"$BODY")"
  echo "Set it in Vercel as SUBSTRATAL_WEBHOOK_SECRET, redeploy, then send a test:"
  echo "  POST /webhooks/$(jq -r .id <<<"$BODY")/test"
  exit 0
fi

call GET /users/me
[[ "$STATUS" == 200 ]] || fail "GET /users/me: HTTP $STATUS: $BODY"
ME=$(jq -r .id <<<"$BODY")
echo "signed in as $ME"

# Favorites are stored as per-app settings overrides. The schema can't cap
# list lengths (no maxItems), so the site enforces Top 5 / 20 itself
# (lib/accountSettings.ts). `theme` is a reserved key and isn't declared.
# Both lists are marked x-pii so they're removed if a user deletes their account.
APP=$(jq -n --arg owner "$ME" --arg site "$SITE" '{
  name: "Dashing Arrivals",
  description: "Live transit map for the Puget Sound region. An optional account saves your theme, Top 5 Routes, and stops.",
  launch_url: $site,
  support_url: $site,
  email_from_name: "Dashing Arrivals",
  visibility: "public",
  access_tier: "free",
  first_party: true,
  review_status: "approved",
  owner_user_id: $owner,
  settings_schema: {
    type: "object",
    properties: {
      favorite_routes: {
        type: "array",
        "x-pii": true,
        default: [],
        items: {
          type: "object",
          properties: {
            agency:     {type: "string", maxLength: 80},
            route_id:   {type: "string", maxLength: 80},
            short_name: {type: "string", maxLength: 80},
            color:      {type: "string", maxLength: 16}
          }
        }
      },
      favorite_stops: {
        type: "array",
        "x-pii": true,
        default: [],
        items: {
          type: "object",
          properties: {
            id:        {type: "string", maxLength: 80},
            code:      {type: "string", maxLength: 80},
            name:      {type: "string", maxLength: 80},
            lat:       {type: "number", minimum: -90,  maximum: 90},
            lon:       {type: "number", minimum: -180, maximum: 180},
            direction: {type: "string", maxLength: 80}
          }
        }
      }
    }
  }
}')

step "Register $APP_ID"
call POST /applications "$(jq '. + {slug: "dashingarrivals"}' <<<"$APP")"
if [[ "$STATUS" == 201 ]]; then
  echo "created $(jq -r .id <<<"$BODY")"
elif [[ "$STATUS" == 409 && $(jq -r '.error.code // .code // empty' <<<"$BODY") == slug_taken ]]; then
  call PATCH "/applications/$APP_ID" "$APP"
  [[ "$STATUS" == 200 ]] || fail "update $APP_ID: HTTP $STATUS: $BODY"
  echo "$APP_ID already existed; updated it to these settings"
else
  fail "register $APP_ID: HTTP $STATUS: $BODY"
fi

step "Check: your settings for $APP_ID"
call GET "/users/me/apps/$APP_ID/settings"
[[ "$STATUS" == 200 ]] || fail "settings: HTTP $STATUS: $BODY"
jq '{resolved: {theme: .resolved.theme, favorite_routes: .resolved.favorite_routes, favorite_stops: .resolved.favorite_stops}, sources: {theme: .sources.theme}}' <<<"$BODY"

cat <<EOF

Done. $APP_ID is registered with free access for every Substratal account.
Next: set NEXT_PUBLIC_ACCOUNTS_ENABLED=true in Vercel and deploy. Once the
site is live, run: scripts/register-dashingarrivals.sh webhook
EOF
