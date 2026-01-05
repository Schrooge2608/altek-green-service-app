import React from 'react';

export default function DocumentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="bg-background">{children}</main>;
}
