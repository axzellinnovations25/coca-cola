import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  robots: "index, follow",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen w-full bg-slate-50 text-slate-900">
      <header className="w-full bg-gradient-to-br from-[#0f766e] via-[#0e9aa4] to-[#0c2134]">
        <div className="mx-auto w-full max-w-3xl px-5 py-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
            <span className="h-2 w-2 rounded-full bg-[#b2f54a]" />
            RepRoute
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">Support</h1>
          <p className="mt-2 text-sm text-white/80">Help, troubleshooting, and privacy requests</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[15px] leading-7 text-slate-700">
            RepRoute is provided to authorized business users. For account access, password resets, data deletion requests,
            or operational support, contact your organization administrator or use the contact details below.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Email</p>
              <p className="mt-2 text-[15px] leading-7 text-slate-700">
                <a
                  className="font-semibold text-[#0f766e] underline decoration-[#b2f54a]/70 underline-offset-4 hover:text-[#0c2134]"
                  href="mailto:axzellinnovations@gmail.com"
                >
                  axzellinnovations@gmail.com
                </a>
              </p>
              <p className="mt-1 text-xs text-slate-500">Best for screenshots and detailed issue reports.</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Phone</p>
              <p className="mt-2 text-[15px] leading-7 text-slate-700">
                <a
                  className="font-semibold text-[#0f766e] underline decoration-[#b2f54a]/70 underline-offset-4 hover:text-[#0c2134]"
                  href="tel:+94768180977"
                >
                  +94 76 818 0977
                </a>
              </p>
              <p className="mt-1 text-xs text-slate-500">For urgent operational issues during working hours.</p>
            </div>
          </div>

          <div className="my-8 h-px w-full bg-slate-200" />

          <section className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Quick links</h2>
              <div className="mt-3 space-y-2 text-[15px] leading-7 text-slate-700">
                <p>
                  Privacy Policy:{' '}
                  <a
                    className="font-semibold text-[#0f766e] underline decoration-[#b2f54a]/70 underline-offset-4 hover:text-[#0c2134]"
                    href="/privacy-policy/"
                  >
                    https://sbdistribution.store/privacy-policy/
                  </a>
                </p>
                <p>
                  Support page:{' '}
                  <a
                    className="font-semibold text-[#0f766e] underline decoration-[#b2f54a]/70 underline-offset-4 hover:text-[#0c2134]"
                    href="/support/"
                  >
                    https://sbdistribution.store/support/
                  </a>
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">Account and access</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-700">
                <p>Contact your organization administrator for:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>New accounts, role changes, shop assignments, and permissions</li>
                  <li>Password resets and login issues</li>
                  <li>Questions about orders, payments, collections, or operational workflows</li>
                </ul>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">Technical support</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-700">
                <p>When reporting a bug or app issue, include as many of these details as possible:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>What you were trying to do and what happened instead</li>
                  <li>Steps to reproduce the issue</li>
                  <li>Device model and OS version (Android/iOS)</li>
                  <li>App version shown in Settings</li>
                  <li>Date/time the issue happened and your network type (Wi‑Fi/mobile data)</li>
                  <li>Screenshots or screen recording (remove sensitive info if needed)</li>
                </ul>
                <p>
                  If your issue relates to printing, include the printer model/name, how it is connected, and whether the
                  printer is paired in device Bluetooth settings.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">Privacy and data requests</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-700">
                <p>
                  You can request access, correction, or deletion of personal data through your organization administrator.
                </p>
                <p>
                  For privacy questions, refer to the Privacy Policy linked above or contact us using the email/phone in this
                  page.
                </p>
              </div>
            </div>
          </section>
        </div>

        <p className="mt-6 text-xs text-slate-500">Last updated: April 30, 2026</p>
      </div>
    </main>
  );
}
