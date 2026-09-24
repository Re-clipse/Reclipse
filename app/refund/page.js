// Starting draft — the actual refund stance (partial refunds vs none) is a
// business decision, not something to infer from code. Confirm this default
// (standard "cancel anytime, no partial refunds" SaaS policy) is what you
// actually want before treating this as final.

export const metadata = { title: 'Refund Policy' };

export default function RefundPage() {
  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1>Refund Policy</h1>
          <p>Last updated: September 2026</p>
        </div>
      </div>
      <div className="stack" style={{ gap: 'var(--s-5)' }}>
        <section>
          <h2>Campus Archive subscription</h2>
          <p>
            Campus Archive is billed monthly. You can cancel anytime from Archive&apos;s
            &quot;Manage membership&quot; link, which takes you to Stripe&apos;s billing portal.
          </p>
          <p>
            Cancelling stops future billing, but you keep access until the end of the period you&apos;ve
            already paid for. We don&apos;t provide partial refunds for time remaining in a billing
            period, except where required by law.
          </p>
        </section>

        <section>
          <h2>Billing mistakes</h2>
          <p>
            If you were charged in error — a duplicate charge, or a charge after you believe you
            cancelled — contact us and we&apos;ll investigate and refund it if it was our mistake.
          </p>
        </section>

        <section>
          <h2>Referral discounts</h2>
          <p>
            Referral rewards are a percentage discount applied to a future month&apos;s bill, not a cash
            refund, and can&apos;t be exchanged for one.
          </p>
        </section>
      </div>
    </main>
  );
}
