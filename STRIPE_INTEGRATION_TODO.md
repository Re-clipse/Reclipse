# Stripe Checkout Integration — TODO

Reclipse has two separate Stripe Checkout Session calls — Campus Archive
(shelved) and Reclipse Plus (the current premium product, built after
Archive was shelved). Both are **Scenario A**: the Checkout Studio
`fixed_by_ui` parameters were merged into each existing
`checkout.sessions.create` call, not built from scratch. This file covers
both; it was first written for Archive alone and extended when Reclipse
Plus's checkout route was added.

## Values to Replace

None in either route. The `sample_only` parameters (`mode`, `success_url`,
`cancel_url`, `line_items`) already had real, non-placeholder values and
were left untouched:

- `mode: 'subscription'` — both products are recurring monthly (or annual,
  for Plus) plans.
- `success_url` / `cancel_url` — built from `NEXT_PUBLIC_SITE_URL` plus a
  real page (the deck the user checked out from, for Archive; `/settings`,
  for Plus).
- `line_items` — built by `archiveLineItem()` / `premiumLineItem()` in
  [lib/stripe.js](lib/stripe.js), which use real `STRIPE_ARCHIVE_PRICE_ID` /
  `STRIPE_PREMIUM_MONTHLY_PRICE_ID` / `STRIPE_PREMIUM_ANNUAL_PRICE_ID` (or
  their cents-based fallbacks), never a hardcoded `price_...` placeholder.

## Configured Parameters

These `fixed_by_ui` parameters from Checkout Studio were added to both
existing Checkout Session calls, identically.

**Files containing these parameters:**
- [app/api/archive/subscribe/route.js](app/api/archive/subscribe/route.js)
- [app/api/premium/subscribe/route.js](app/api/premium/subscribe/route.js)

| Parameter | Value |
|-----------|-------|
| ui_mode | hosted_page |
| billing_address_collection | auto |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| allow_promotion_codes | true |
| payment_method_collection | always |
| submit_type | auto |
| integration_identifier | hosted_web_0001 |
| origin_context | web |

`ui_mode` was set to `hosted_page` (not `hosted`) because `package.json` pins
`stripe` at `^22.6.2`, which is above the 21.0.0 cutoff for the newer value.

## Deviation from the Checkout Studio template

The generic instructions said to remove any Checkout Session parameter not
listed in Field Intents. I did **not** do that in either route for three
parameters that already existed in each call and aren't part of Checkout
Studio's config surface:

- `metadata: { user_id: user.id }`
- `subscription_data: { metadata: { user_id: user.id } }`
- `customer` / `customer_email`

These aren't leftover cruft — each product's own webhook
([archive](app/api/archive/webhook/route.js) /
[premium](app/api/premium/webhook/route.js)) reads `session.metadata.user_id`
(never anything the client sends) to know which Reclipse account to grant
access to when Stripe confirms payment. Removing them would have silently
broken subscription fulfillment: Stripe would still take the payment, but no
one would ever get access. I left them in place untouched in both routes.

## Setup and next steps

1. **`automatic_tax` is off on purpose, in both routes.** Canada's
   small-supplier rule: under CA$30,000 in worldwide taxable revenue over the
   last four consecutive calendar quarters, GST/HST registration (and
   collection) is optional, and this business isn't registered. Once you're
   close to that threshold or register voluntarily, flip
   `automatic_tax: { enabled: true }` back on in
   [app/api/archive/subscribe/route.js](app/api/archive/subscribe/route.js)
   and [app/api/premium/subscribe/route.js](app/api/premium/subscribe/route.js)
   — but activate Stripe Tax and add a tax registration in the Dashboard
   first (https://dashboard.stripe.com/settings/tax), or Stripe will reject
   session creation. Worth a quick confirm with an accountant as you
   approach the threshold — this isn't tax advice.
2. **Production is still missing required env vars for both products.**
   Checkout currently fails server-side (`stripeConfigured()` returns false)
   because production doesn't have `STRIPE_WEBHOOK_SECRET` set. Archive also
   needs `STRIPE_ARCHIVE_PRICE_ID` or `ARCHIVE_MONTHLY_PRICE_CENTS` (why the
   site currently shows Campus Archive as "coming soon" — though Archive is
   shelved, so this may not be worth fixing). Reclipse Plus needs its own
   `STRIPE_PREMIUM_MONTHLY_PRICE_ID`/`STRIPE_PREMIUM_ANNUAL_PRICE_ID` (or
   their cents fallbacks) and its own `STRIPE_PREMIUM_WEBHOOK_SECRET` —
   Stripe signs each webhook endpoint separately, so this is a different
   secret from Archive's `STRIPE_WEBHOOK_SECRET`, configured against a
   different endpoint URL in the Stripe Dashboard. See `.env.example` for
   what each variable does, and match test vs. live mode consistently with
   `STRIPE_SECRET_KEY`.
3. **No other env var changes needed.** This is a Next.js app, not Vite, so
   the `VITE_` prefix rule doesn't apply. `STRIPE_SECRET_KEY` and both
   webhook secrets are server-only and correctly un-prefixed; there's no
   Stripe publishable key anywhere because this uses redirect-based Hosted
   Checkout, not Stripe.js/Elements, so the browser never needs one.
4. **How each integration works:**
   - **Archive** (shelved): `app/settings` and `app/archive` call
     `startArchiveCheckout()` ([lib/archive.js](lib/archive.js)) → POST
     `/api/archive/subscribe` → returns `session.url` → browser redirects.
     On success, redirects back to `/archive?subscribed=1`; Stripe calls
     `/api/archive/webhook`, which verifies the signature, reads
     `session.metadata.user_id`, and upserts `archive_subscriptions`.
   - **Reclipse Plus** (current premium product): same shape, via
     `startPremiumCheckout()` ([lib/premium.js](lib/premium.js)) → POST
     `/api/premium/subscribe` → redirects to `/settings?premium=1` on
     success; Stripe calls `/api/premium/webhook`, upserting
     `premium_subscriptions`. There's no pricing/checkout UI page for
     Reclipse Plus yet — `startPremiumCheckout()` exists and works, but
     nothing on the site calls it yet.
5. **Test card numbers:** use `4242 4242 4242 4242`, any future expiry, any
   CVC, any postal code, while `STRIPE_SECRET_KEY` is a `sk_test_...` key.
   Full list: https://docs.stripe.com/testing
6. **Next steps:** once live, monitor the `checkout.session.completed` and
   subscription-lifecycle events in the Stripe Dashboard for both products,
   and confirm each webhook endpoint is registered there with its own
   matching secret.
7. **Resources:** https://support.stripe.com and https://docs.stripe.com/mcp
