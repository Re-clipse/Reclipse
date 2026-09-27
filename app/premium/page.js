import PremiumClient from './PremiumClient';
import { premiumDisplayPrice } from '@/lib/stripe';

export async function generateMetadata() {
  const price = await premiumDisplayPrice('month');
  return {
    title: 'Reclipse Plus — unlimited studying',
    description: price
      ? 'No daily generation limit, more monthly flashcards, and the Lab Prep AI chat.'
      : 'Reclipse Plus is coming soon — no daily generation limit, more flashcards, and the Lab Prep AI chat.',
  };
}

export default function PremiumPage() {
  return <PremiumClient />;
}
