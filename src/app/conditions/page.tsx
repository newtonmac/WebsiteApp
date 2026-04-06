import { Metadata } from 'next';
import { ConditionsClient } from './ConditionsClient';

export const metadata: Metadata = {
  title: 'Water Conditions',
  alternates: { canonical: '/conditions' },
  description: 'Real-time water conditions, tides, water quality, and paddle scores for SUP, kayak, outrigger, and canoe paddlers.',
  openGraph: {
    title: 'PaddlePoint — Water Conditions',
    description: 'Real-time water conditions, tides, water quality, and paddle scores for paddlers.',
  },
};

export default function ConditionsPage() {
  return <ConditionsClient />;
}
