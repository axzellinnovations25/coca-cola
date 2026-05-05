import React, { useEffect, useState } from "react";
import { apiFetch } from "../../../utils/api";
import OrderLogTable from "./OrderLogTable";

export default function Returns() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    apiFetch("/api/marudham/orders/logs")
      .then((data) => {
        const logs = data?.logs || [];
        const onlyReturns = logs.filter(
          (l: any) => String(l.action || "").toLowerCase() === "return",
        );
        setReturns(onlyReturns);
      })
      .catch((err) => setError(err.message || "Failed to load returns"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        Sales Returns
      </h2>
      <p className="text-gray-600 mb-4 text-sm">
        All returns recorded by sales representatives.
      </p>
      {loading ? (
        <div className="text-gray-400 text-center py-8">Loading returns...</div>
      ) : error ? (
        <div className="text-red-500 text-center py-8">{error}</div>
      ) : returns.length === 0 ? (
        <div className="text-gray-400 text-center py-8">
          No returns recorded.
        </div>
      ) : (
        <OrderLogTable logs={returns} />
      )}
    </div>
  );
}
