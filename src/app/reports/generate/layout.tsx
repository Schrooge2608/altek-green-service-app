import React from 'react';

export const maxDuration = 60; // 60 seconds timeout for Vercel

export default function GenerateReportLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
