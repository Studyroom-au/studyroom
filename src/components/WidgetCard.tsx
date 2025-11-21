import React from "react";

export default function WidgetCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--sr-ring,#e5e7eb)] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="min-h-[120px]">{children}</div>
    </section>
  );
}
