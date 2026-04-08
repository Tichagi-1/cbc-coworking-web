import Link from "next/link";

export default function DashboardHome() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      <p className="text-gray-600 mt-2">
        Welcome to CBC Coworking OS. Jump into the{" "}
        <Link href="/dashboard/map" className="text-cbc-blue hover:underline">
          floor map
        </Link>{" "}
        to start managing units.
      </p>
    </div>
  );
}
