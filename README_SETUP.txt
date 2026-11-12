NINS SQUARE SANDBOX ONLY (NO LIVE CHARGES)

Site: https://nins-checkout.netlify.app/

Contains public index.html with embedded Square Sandbox card form, branding, and backend netlify/functions/square-payment.mjs.

DO NOT paste Square access tokens into these files. The Netlify environment secret SQUARE_ACCESS_TOKEN is already configured in your Netlify dashboard.

DEPLOYMENT: A simple manual ZIP or drag-and-drop deploy MAY NOT bundle Netlify functions. Recommended reliable route: import this project into a Git repository and connect that repository to the EXISTING Netlify site for automatic builds, OR deploy through Netlify CLI. Do not create a duplicate Netlify site. Use netlify.toml with build publish and functions.

VERIFY: GET https://nins-checkout.netlify.app/.netlify/functions/square-payment should yield JSON with mode sandbox, ready true, realPaymentsEnabled false. If 404, the function was not deployed; do NOT test payments.

Square Sandbox public application ID and Location ID are in the HTML and function; token is environment-only. No production payment code.

TEST: Use only Square official Sandbox test card; do not enter any real credit card. The $25,089.31 / $42,360.16 payment simulations are preliminary test fixtures. Complete materials pricing and tax review are REQUIRED before creating production payments.

SECURITY: The frontend/server guard test-only status, does not accept client-provided prices, prevents cross-origin browser requests, and calls only Square Sandbox API. For production further security, tax, anti-abuse rate limiting and purchase order reconciliation are required.
