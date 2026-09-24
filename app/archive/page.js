import ArchiveClient from './ArchiveClient';

export const metadata = {
  title: 'Campus Archive — course study sets',
  description: 'Complete flashcard sets for specific courses, shared by other students who’ve taken them. One membership unlocks every set in the archive.',
};

export default function ArchivePage() {
  return <ArchiveClient />;
}
