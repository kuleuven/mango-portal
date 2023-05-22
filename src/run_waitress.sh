#!/bin/bash


cd `dirname "$0"`

echo "Starting instance from directory $(dirname $0)"

export SERVICE_PORT=3000
export spOption="mango_portal"

#export MANGO_AUTH="via_callback"
export MANGO_AUTH=localdev
export HOSTNAME

export OIDC_ISSUER_URL=https://idp.kuleuven.be/auth/realms/kuleuven
export OIDC_CLIENT_ID=oidcapp
export OPENID_REDIRECT_BASE=http://localhost:3000

# To test kuleuven login locally, ask Peter for the secret and run
#   export OIDC_SECRET=XXXX
# in your shell prior to running this script. You also need to set
# a local alias voor oidcapp.icts.kuleuven.be.
# See also https://ceifdoc.icts.kuleuven.be/devops/development/go-webapp-basis/#basis-setup-development
if [ -n "$OIDC_SECRET" ]; then
  export OPENID_REDIRECT_BASE=http://oidcapp.icts.kuleuven.be:3000
  #export MANGO_AUTH=
fi

export API_URL=https://icts-q-coz-data-platform-api.cloud.q.icts.kuleuven.be
#export API_URL=https://icts-p-coz-data-platform-api.cloud.icts.kuleuven.be

# To test with data platform api, generate a token
# Needed for mango_open_search plugin, not for data_platform plugin
if which data-platform-cli &>/dev/null; then
  export API_TOKEN=$(data-platform-cli token --tier q)
fi

export DEBUG=True
# Enable the Flask debug toolbar by uncommenting the line below
# export FLASK_DEBUG_TOOLBAR=enabled

# Hupper will reload the app upon changed files after 5 secs
hupper --shutdown-interval 5  -m  waitress_serve
