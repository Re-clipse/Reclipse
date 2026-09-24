import DemoClient from './DemoClient';

export const metadata = {
  title: 'Try the demo',
  description: 'A 30-second, no-login demo of the real Reclipse flashcard and quiz flow — see what active recall feels like before you sign up.',
};

export default function DemoPage() {
  return <DemoClient />;
}
