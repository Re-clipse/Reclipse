import ArchiveClient from './ArchiveClient';
import { archiveDisplayPrice } from '@/lib/stripe';

export async function generateMetadata() {
  const price = await archiveDisplayPrice();
  return {
    title: 'Campus Archive — course study sets',
    description: price
      ? 'Complete flashcard sets for specific courses, shared by other students who’ve taken them. One membership unlocks every set in the archive.'
      : 'Complete flashcard sets for specific courses, shared by other students who’ve taken them. Membership is coming soon.',
  };
}

export default function ArchivePage() {
  return <ArchiveClient />;
}
