# Stripe Checkout Integration — TODO

Reclipse already had a working Stripe Checkout integration (the Campus Archive
monthly subscription), so this was **Scenario A**: the Checkout Studio
`fixed_by_ui` parameters were merged into the existing `checkout.sessions.create`
call rather than a new integration being built from scratch.

## Values to Replace

None. The `sample_only` parameters (`mode`, `success_url`, `cancel_url`,
`line_items`) already had real, non-placeholder values in the existing code
and were left untouched:

- `mode: 'subscription'` — Campus Archive is a recurring monthly plan.
- `success_url` / `cancel_url` — built from `NEXT_PUBLIC_SITE_URL` plus the
  page the user checked out from.
- `line_items` — built by `archiveLineItem()` in
  [lib/stripe.js](lib/stripe.js), which uses your real `STRIPE_ARCHIVE_PRICE_ID`
  (or `ARCHIVE_MONTHLY_PRICE_CENTS` as a fallback), not a hardcoded `price_...`
  placeholder.

## Configured Parameters

These `fixed_by_ui` parameters from Checkout Studio were added to the
existing Checkout Session call.

**Files containing these parameters:**
- [app/api/archive/subscribe/route.js](app/api/archive/subscribe/route.js)

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
listed in Field Intents. I did **not** do that here for three parameters that
already existed in the call and aren't part of Checkout Studio's config
surface:

- `metadata: { user_id: user.id }`
- `subscription_data: { metadata: { user_id: user.id } }`
- `customer` / `customer_email`

These aren't leftover cruft — `app/api/archive/webhook/route.js` reads
`session.metadata.user_id` (never anything the client sends) to know which
Reclipse account to grant archive access to when Stripe confirms payment.
Removing them would have silently broken subscription fulfillment: Stripe
would still take the payment, but no one would ever get access. I left them
in place untouched.

## Setup and next steps

1. **`automatic_tax` is off on purpose.** Canada's small-supplier rule: under
   CA$30,000 in worldwide taxable revenue over the last four consecutive
   calendar quarters, GST/HST registration (and collection) is optional, and
   this business isn't registered. Once you're close to that threshold or
   register voluntarily, flip `automatic_tax: { enabled: true }` back on in
   [app/api/archive/subscribe/route.js](app/api/archive/subscribe/route.js)
   — but activate Stripe Tax and add a tax registration in the Dashboard
   first (https://dashboard.stripe.com/settings/tax), or Stripe will reject
   session creation. Worth a quick confirm with an accountant as you
   approach the threshold — this isn't tax advice.
2. **Production is still missing required env vars.** Checkout currently
   fails server-side (`stripeConfigured()` returns false) because Vercel's
   production environment doesn't have `STRIPE_WEBHOOK_SECRET` set, and
   neither `STRIPE_ARCHIVE_PRICE_ID` nor `ARCHIVE_MONTHLY_PRICE_CENTS` is set
   either — this is why the site currently shows Campus Archive as "coming
   soon." Set these three in the Vercel project's environment variables
   (see `.env.example` for what each does), matching test vs. live mode
   consistently with `STRIPE_SECRET_KEY`.
3. **No other env var changes needed.** This is a Next.js app, not Vite, so
   the `VITE_` prefix rule doesn't apply. `STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET` are server-only and correctly un-prefixed; there's
   no Stripe publishable key anywhere because this uses redirect-based Hosted
   Checkout, not Stripe.js/Elements, so the browser never needs one.
4. **How the integration works:** `app/settings` and `app/archive` call
   `startArchiveCheckout()` ([lib/archive.js](lib/archive.js)) → POST
   `/api/archive/subscribe` → this route builds the Checkout Session and
   returns `session.url` → the browser redirects there. On success, Stripe
   redirects back to `/archive?subscribed=1`. Stripe then calls
   `/api/archive/webhook`, which verifies the signature, reads
   `session.metadata.user_id`, and upserts a row in `archive_subscriptions`
   granting that user access — see
   [app/api/archive/webhook/route.js](app/api/archive/webhook/route.js).
5. **Test card numbers:** use `4242 4242 4242 4242`, any future expiry, any
   CVC, any postal code, while `STRIPE_SECRET_KEY` is a `sk_test_...` key.
   Full list: https://docs.stripe.com/testing
6. **Next steps:** once live, monitor the `checkout.session.completed` and
   subscription-lifecycle events in the Stripe Dashboard, and confirm the
   webhook endpoint is registered there with the same secret as
   `STRIPE_WEBHOOK_SECRET`.
7. **Resources:** https://support.stripe.com and https://docs.stripe.com/mcp
