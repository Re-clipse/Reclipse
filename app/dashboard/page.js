'use client';
// Old route — kept so existing links/bookmarks keep working.
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function Redirect() {
  const router = useRouter();
  const deck = useSearchParams().get('deck');
  useEffect(() => { router.replace(deck ? `/study?deck=${deck}` : '/decks'); }, [deck, router]);
  return <main className="page"><div className="skeleton" style={{ height: 240 }} /></main>;
}
export default function Page() {
  return <Suspense fallback={null}><Redirect /></Suspense>;
}
