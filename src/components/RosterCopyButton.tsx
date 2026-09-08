import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth, db } from '../firebase';

export default function RosterCopyButton() {
  const { eventId } = useParams<{ eventId: string }>();
  const [players, setPlayers] = useState<any[]>([]);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [eventStatus, setEventStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!eventId || !auth.currentUser) return;

    const unsubscribeEvent = onSnapshot(doc(db, 'events', eventId), (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      setIsOrganizer(data.organizerId === auth.currentUser?.uid);
      setEventStatus(data.status ?? null);
    });

    const unsubscribePlayers = onSnapshot(collection(db, 'events', eventId, 'players'), (snapshot) => {
      const roster = snapshot.docs.map((playerDoc) => playerDoc.data());
      roster.sort((a, b) => {
        if (!a.joinedAt || !b.joinedAt) return 0;
        return a.joinedAt.toMillis() - b.joinedAt.toMillis();
      });
      setPlayers(roster);
    });

    return () => {
      unsubscribeEvent();
      unsubscribePlayers();
    };
  }, [eventId]);

  const copyRosterNames = async () => {
    const names = players
      .map((player) => String(player.displayName ?? '').trim())
      .filter(Boolean)
      .join('\n');

    if (!names) return;

    try {
      await navigator.clipboard.writeText(names);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Unable to copy roster names:', error);
    }
  };

  if (!isOrganizer || eventStatus !== 'lobby') return null;

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <Button
        onClick={copyRosterNames}
        disabled={players.length === 0}
        className="h-11 px-5 border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 hover:-translate-y-0.5"
        aria-label="Copy all roster names to clipboard"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 mr-2 text-green-400" /> Names Copied
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 mr-2" /> Copy Roster Names
          </>
        )}
      </Button>
    </div>
  );
}
