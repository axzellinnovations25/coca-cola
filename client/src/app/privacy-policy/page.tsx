import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: "index, follow",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen w-full bg-slate-50 text-slate-900">
      <header className="w-full bg-gradient-to-br from-[#0f766e] via-[#0e9aa4] to-[#0c2134]">
        <div className="mx-auto w-full max-w-3xl px-5 py-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
            <span className="h-2 w-2 rounded-full bg-[#b2f54a]" />
            RepRoute
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">Privacy Policy</h1>
          <p className="mt-2 text-sm text-white/80">Effective date: April 30, 2026</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <section className="space-y-4 text-[15px] leading-7 text-slate-700">
            <p>
              This Privacy Policy applies to RepRoute, a mobile application for sales representatives to manage assigned
              shops, orders, collections, receipts, and related field operations.
            </p>
            <p>
              RepRoute is intended for authorized business users only. Accounts are provided and managed by the
              organization using the system.
            </p>
            <p>
              Support contact:{' '}
              <a
                className="font-semibold text-[#0f766e] underline decoration-[#b2f54a]/70 underline-offset-4 hover:text-[#0c2134]"
                href="mailto:axzellinnovations@gmail.com"
              >
                axzellinnovations@gmail.com
              </a>{' '}
              /{' '}
              <a
                className="font-semibold text-[#0f766e] underline decoration-[#b2f54a]/70 underline-offset-4 hover:text-[#0c2134]"
                href="tel:+94768180977"
              >
                +94 76 818 0977
              </a>
            </p>
          </section>

          <div className="my-8 h-px w-full bg-slate-200" />

          <section className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Information We Collect</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-slate-700">
                <li>Account information such as name, email address, and user role.</li>
                <li>Authentication and session information (for example tokens and session identifiers).</li>
                <li>
                  Business operation data such as shops, addresses, phone numbers, orders, products, payments, collections,
                  returns, and receipt details.
                </li>
                <li>
                  Bluetooth printer information (for example paired printer names and MAC address) when you choose to scan
                  for or save a receipt printer.
                </li>
                <li>Basic device and technical information needed to operate, secure, and troubleshoot the service.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">Bluetooth and Location Permission</h2>
              <p className="mt-3 text-[15px] leading-7 text-slate-700">
                RepRoute uses Bluetooth permissions to find paired receipt printers and print receipts. On some Android
                versions, Android requires location permission before Bluetooth scanning can work. RepRoute uses this
                permission only to discover nearby paired Bluetooth printers and does not use it to track your physical
                location.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">How We Use Information</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-slate-700">
                <li>Provide sign-in, session management, and secure API access.</li>
                <li>Display assigned shops, orders, collections, and outstanding balances.</li>
                <li>Create and manage orders and payments based on user permissions.</li>
                <li>Support receipt printing through paired Bluetooth printers.</li>
                <li>Maintain security, prevent abuse, and improve reliability.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">Sharing of Information</h2>
              <p className="mt-3 text-[15px] leading-7 text-slate-700">
                RepRoute sends app data to the backend service that powers the sales management system. We do not sell
                personal information. We may disclose information if required by law or to protect the service and its
                users.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">Local Storage</h2>
              <p className="mt-3 text-[15px] leading-7 text-slate-700">
                RepRoute stores session tokens and the selected Bluetooth printer identifier on the device to keep you
                signed in and remember your chosen printer. You can clear this by logging out, clearing app storage, or
                uninstalling the app.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">Data Retention and Deletion</h2>
              <p className="mt-3 text-[15px] leading-7 text-slate-700">
                Business records are retained as needed to provide the service and comply with obligations. Deletion
                requests should be submitted through your organization administrator or via the support contact page.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">Changes</h2>
              <p className="mt-3 text-[15px] leading-7 text-slate-700">
                We may update this Privacy Policy when the app, service, or legal requirements change. Updates will be
                posted on this page with a revised effective date.
              </p>
            </div>
          </section>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Last updated: April 30, 2026
        </p>
      </div>
    </main>
  );
}
