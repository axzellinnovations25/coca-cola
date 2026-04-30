import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  robots: "index, follow",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen w-full bg-white text-gray-900">
      <div className="mx-auto w-full max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Support</h1>
        <p className="mt-4 text-[15px] leading-7 text-gray-800">
          RepRoute is provided to authorized business users. For account access, password resets, data deletion requests,
          or operational support, contact your organization administrator or the developer contact shown on the app store
          listing.
        </p>

        <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-5 text-[15px] leading-7 text-gray-800">
          <p className="font-semibold text-gray-900">Privacy</p>
          <p className="mt-2">
            Privacy Policy: <a className="text-teal-700 underline" href="/privacy-policy/">/privacy-policy/</a>
          </p>
        </div>
      </div>
    </main>
  );
}

