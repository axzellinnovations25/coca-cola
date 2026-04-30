import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: "index, follow",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen w-full bg-white text-gray-900">
      <div className="mx-auto w-full max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-600">Effective date: April 30, 2026</p>

        <section className="mt-8 space-y-4 text-[15px] leading-7 text-gray-800">
          <p>
            This Privacy Policy applies to RepRoute, a mobile application for sales representatives to manage assigned
            shops, orders, collections, receipts, and related field operations.
          </p>
          <p>
            RepRoute is intended for authorized business users only. Accounts are provided and managed by the organization
            using the system.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Information We Collect</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-gray-800">
            <li>Account information such as name, email address, and user role.</li>
            <li>Authentication and session information (for example tokens and session identifiers).</li>
            <li>
              Business operation data such as shops, addresses, phone numbers, orders, products, payments, collections,
              returns, and receipt details.
            </li>
            <li>
              Bluetooth printer information (for example paired printer names and MAC address) when you choose to scan for
              or save a receipt printer.
            </li>
            <li>Basic device and technical information needed to operate, secure, and troubleshoot the service.</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Bluetooth and Location Permission</h2>
          <p className="mt-3 text-[15px] leading-7 text-gray-800">
            RepRoute uses Bluetooth permissions to find paired receipt printers and print receipts. On some Android
            versions, Android requires location permission before Bluetooth scanning can work. RepRoute uses this
            permission only to discover nearby paired Bluetooth printers and does not use it to track your physical
            location.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">How We Use Information</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-gray-800">
            <li>Provide sign-in, session management, and secure API access.</li>
            <li>Display assigned shops, orders, collections, and outstanding balances.</li>
            <li>Create and manage orders and payments based on user permissions.</li>
            <li>Support receipt printing through paired Bluetooth printers.</li>
            <li>Maintain security, prevent abuse, and improve reliability.</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Sharing of Information</h2>
          <p className="mt-3 text-[15px] leading-7 text-gray-800">
            RepRoute sends app data to the backend service that powers the sales management system. We do not sell personal
            information. We may disclose information if required by law or to protect the service and its users.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Local Storage</h2>
          <p className="mt-3 text-[15px] leading-7 text-gray-800">
            RepRoute stores session tokens and the selected Bluetooth printer identifier on the device to keep you signed
            in and remember your chosen printer. You can clear this by logging out, clearing app storage, or uninstalling
            the app.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Data Retention and Deletion</h2>
          <p className="mt-3 text-[15px] leading-7 text-gray-800">
            Business records are retained as needed to provide the service and comply with obligations. Deletion requests
            should be submitted through your organization administrator or via the support contact page.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Changes</h2>
          <p className="mt-3 text-[15px] leading-7 text-gray-800">
            We may update this Privacy Policy when the app, service, or legal requirements change. Updates will be posted
            on this page with a revised effective date.
          </p>
        </section>
      </div>
    </main>
  );
}

