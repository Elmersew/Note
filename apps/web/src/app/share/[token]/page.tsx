import type { Metadata } from 'next';
import { SharedNote } from '@/components/shared-note';

export const metadata: Metadata = {
  title: '分享便签 · 拾光便签',
  robots: { index: false, follow: false },
};

export default function SharedNotePage() {
  return <SharedNote />;
}
