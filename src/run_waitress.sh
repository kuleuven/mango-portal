#!/bin/bash


cd `dirname "$0"`

echo "Starting instance from directory $(dirname $0)"

export SERVICE_PORT=3000
export spOption="mango_portal"

#export MANGO_AUTH="via_callback"
export HOSTNAME

export OIDC_ISSUER_URL=https://idp.kuleuven.be/auth/realms/kuleuven
export OIDC_CLIENT_ID=oidcapp

# To test kuleuven login locally, uncomment the following lines and ask Peter for the secret
# See also https://ceifdoc.icts.kuleuven.be/devops/development/go-webapp-basis/#basis-setup-development
export OPENID_REDIRECT_BASE=http://oidcapp.icts.kuleuven.be:3000
#export OIDC_SECRET=

export API_URL=https://icts-q-coz-data-platform-api.cloud.q.icts.kuleuven.be

# Hupper will reload the app upon changed files after 5 secs
hupper --shutdown-interval 5  -m  waitress_serve
