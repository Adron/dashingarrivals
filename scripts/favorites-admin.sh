#!/usr/bin/env bash
# Audit and clean saved favorites for app_dashingarrivals, as the Substratal
# superadmin (needs users.list to read, users.manage to clear).
#
#   scripts/favorites-admin.sh                          # every account's Top 5 + stops
#   scripts/favorites-admin.sh clear <user_id> [routes|stops|all]
#
# Before favorites were tied strictly to accounts, routes starred while signed
# out (or while an account's settings were unavailable) were merged into the
# next account to sign in on that browser. Use `list` to spot routes that
# don't belong, then `clear` that account's list; its owner re-stars their own.
# The "Most Popular Top 5" tally catches up the next time that user signs in.
#
# It asks for the superadmin's password and current two-factor code, so
# nothing secret lands in shell history. With TOKEN set it skips sign-in.
set -euo pipefail

API="${SUBSTRATAL_API:-https://api.substratalapps.com}"
EMAIL="${SUPERADMIN_EMAIL:-adronhall@proton.me}"
APP_ID="app_dashingarrivals"
VERSION="Substratal-Version: 1"
need() { command -v "$1" >/dev/null || { echo "favorites-admin: $1 is required" >&2; exit 1; }; }
need curl
need jq

post() { # path json
  curl -sS -X POST "$API$1" -H "$VERSION" -H "Content-Type: application/json" -d "$2" -w '\n%{http_code}'
}
call() { # method path [json]
  local args=(-sS -X "$1" "$API$2" -H "$VERSION" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -w '\n%{http_code}')
  [[ -n "${3:-}" ]] && args+=(-d "$3")
  local out; out=$(curl "${args[@]}")
  STATUS=${out##*$'\n'}; BODY=${out%$'\n'*}
}
fail() { echo "favorites-admin: $*" >&2; exit 1; }

signed_in_here=false
if [[ -z "${TOKEN:-}" ]]; then
  echo "Sign in as $EMAIL"
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

if [[ "${1:-list}" == clear ]]; then
  USER_ID="${2:?usage: favorites-admin.sh clear <user_id> [routes|stops|all]}"
  case "${3:-routes}" in
    routes) BODYJSON='{"overrides":{"favorite_routes":null}}' ;;
    stops)  BODYJSON='{"overrides":{"favorite_stops":null}}' ;;
    all)    BODYJSON='{"overrides":{"favorite_routes":null,"favorite_stops":null}}' ;;
    *) fail "clear what? routes, stops, or all" ;;
  esac
  call PATCH "/users/$USER_ID/apps/$APP_ID/settings" "$BODYJSON"
  [[ "$STATUS" == 200 ]] || fail "clear $USER_ID: HTTP $STATUS: $BODY"
  echo "cleared ${3:-routes} for $USER_ID"
  exit 0
fi

# list: every active account, and its favorites if it has any.
cursor=""
while :; do
  call GET "/users?status=active&limit=100${cursor:+&cursor=$cursor}"
  [[ "$STATUS" == 200 ]] || fail "list users: HTTP $STATUS: $BODY"
  page=$BODY
  for row in $(jq -r '.data[] | "\(.id)|\(.email)"' <<<"$page"); do
    id=${row%%|*}; email=${row#*|}
    call GET "/users/$id/apps/$APP_ID/settings"
    [[ "$STATUS" == 200 ]] || continue # no access to the app
    jq -r --arg email "$email" '
      (.resolved.favorite_routes // []) as $r | (.resolved.favorite_stops // []) as $s |
      select(($r | length) + ($s | length) > 0) |
      "\(.user_id)  \($email)\n  routes: \([$r[] | "\(.agency):\(.short_name // .route_id)"] | join(", "))\n  stops:  \([$s[] | .name] | join(", "))"
    ' <<<"$BODY"
  done
  [[ $(jq -r '.page.has_more' <<<"$page") == true ]] || break
  cursor=$(jq -r '.page.next_cursor | @uri' <<<"$page")
done
