import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, setDoc, updateDoc, deleteDoc, serverTimestamp, getDoc, deleteField } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Copy, Check, Play, RefreshCw, Trash2, Edit2, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'motion/react';

export default function Event() {
  const { eventId } = useParams<{ eventId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [editPlayerId, setEditPlayerId] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  useEffect(() => {
    if (!eventId || !auth.currentUser) return;

    const eventRef = doc(db, 'events', eventId);
    const playersRef = collection(db, 'events', eventId, 'players');

    const unsubscribeEvent = onSnapshot(eventRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEvent(data);
        setIsOrganizer(data.organizerId === auth.currentUser?.uid);
      } else {
        alert('Event not found');
        navigate('/');
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching event:", error);
      setLoading(false);
    });

    const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
      const playersData = snapshot.docs.map(doc => doc.data());
      // Sort by joinedAt
      playersData.sort((a, b) => {
        if (!a.joinedAt || !b.joinedAt) return 0;
        return a.joinedAt.toMillis() - b.joinedAt.toMillis();
      });
      setPlayers(playersData);
    }, (error) => {
      console.error("Error fetching players:", error);
    });

    return () => {
      unsubscribeEvent();
      unsubscribePlayers();
    };
  }, [eventId, navigate]);

  useEffect(() => {
    const joinEvent = async () => {
      if (!eventId || !auth.currentUser || isOrganizer) return;
      
      const playerName = location.state?.playerName;
      
      // Check if player already exists
      const playerRef = doc(db, 'events', eventId, 'players', auth.currentUser.uid);
      const playerSnap = await getDoc(playerRef);
      
      if (!playerSnap.exists() && playerName) {
        try {
          await setDoc(playerRef, {
            id: auth.currentUser.uid,
            eventId: eventId,
            displayName: playerName,
            joinedAt: serverTimestamp(),
            isOrganizer: false,
          });
        } catch (error) {
          console.error("Error joining event:", error);
        }
      }
    };

    if (!loading && event) {
      joinEvent();
    }
  }, [eventId, loading, event, location.state, isOrganizer]);

  const copyToClipboard = () => {
    if (eventId) {
      navigator.clipboard.writeText(eventId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartEvent = async () => {
    if (!eventId || !isOrganizer) return;
    
    // Generate pods
    // Simple logic: group by 4, if remainder is 1, 2, or 3, distribute or make smaller pods
    // For simplicity, let's just group into 4s, and the last pod might have 3, 4, or 5 if we merge
    
    let shuffledPlayers = [...players].sort(() => 0.5 - Math.random());
    let pods = [];
    let podCount = 1;
    
    while (shuffledPlayers.length > 0) {
      if (shuffledPlayers.length === 5) {
        // Make one pod of 5
        pods.push({
          podNumber: podCount++,
          playerIds: shuffledPlayers.map(p => p.id)
        });
        shuffledPlayers = [];
      } else if (shuffledPlayers.length >= 4) {
        pods.push({
          podNumber: podCount++,
          playerIds: shuffledPlayers.splice(0, 4).map(p => p.id)
        });
      } else {
        // Remaining 1, 2, or 3 players
        pods.push({
          podNumber: podCount++,
          playerIds: shuffledPlayers.map(p => p.id)
        });
        shuffledPlayers = [];
      }
    }

    try {
      await updateDoc(doc(db, 'events', eventId), {
        status: 'started',
        pods: JSON.stringify(pods)
      });
    } catch (error) {
      console.error("Error starting event:", error);
    }
  };

  const handleResetEvent = async () => {
    if (!eventId || !isOrganizer) return;
    try {
      await updateDoc(doc(db, 'events', eventId), {
        status: 'lobby',
        pods: deleteField()
      });
    } catch (error) {
      console.error("Error resetting event:", error);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!eventId || !isOrganizer) return;
    if (confirm('Are you sure you want to remove this player?')) {
      try {
        await deleteDoc(doc(db, 'events', eventId, 'players', playerId));
      } catch (error) {
        console.error("Error removing player:", error);
      }
    }
  };

  const handleEditPlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !isOrganizer || !editPlayerId || !editPlayerName) return;
    
    try {
      await updateDoc(doc(db, 'events', eventId, 'players', editPlayerId), {
        displayName: editPlayerName
      });
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating player:", error);
    }
  };

  const handleAddPlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !isOrganizer || !newPlayerName) return;
    
    try {
      const newPlayerId = 'manual_' + Math.random().toString(36).substring(2, 9);
      await setDoc(doc(db, 'events', eventId, 'players', newPlayerId), {
        id: newPlayerId,
        eventId: eventId,
        displayName: newPlayerName,
        joinedAt: serverTimestamp(),
        isOrganizer: false,
      });
      setNewPlayerName('');
      setIsAddModalOpen(false);
    } catch (error) {
      console.error("Error adding player:", error);
    }
  };

  const openEditModal = (player: any) => {
    setEditPlayerId(player.id);
    setEditPlayerName(player.displayName);
    setIsEditModalOpen(true);
  };

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Loading...</div>;
  }

  if (!event) {
    return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Event not found.</div>;
  }

  const joinUrl = `${window.location.origin}/event/${eventId}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{event.name}</h1>
              <Badge variant={event.status === 'lobby' ? 'secondary' : 'default'} className="uppercase tracking-wider">
                {event.status}
              </Badge>
            </div>
            <p className="text-zinc-400 flex items-center gap-2">
              {event.format} • {players.length} {event.maxPlayers ? `/ ${event.maxPlayers}` : ''} Players
            </p>
          </div>
          
          {event.status === 'lobby' && (
            <div className="flex items-center gap-4 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <div className="bg-white p-2 rounded-lg">
                <QRCodeSVG value={joinUrl} size={64} />
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase font-semibold mb-1">Join Code</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-mono font-bold tracking-widest">{event.id}</span>
                  <Button variant="ghost" size="icon" onClick={copyToClipboard} className="h-8 w-8 text-zinc-400 hover:text-white">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Organizer Controls */}
        {isOrganizer && event.status === 'lobby' && (
          <div className="flex justify-end gap-4">
            <Button 
              onClick={() => setIsAddModalOpen(true)} 
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <UserPlus className="w-4 h-4 mr-2" /> Add Player
            </Button>
            <Button 
              onClick={handleStartEvent} 
              disabled={players.length < 2}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8"
            >
              <Play className="w-4 h-4 mr-2" /> Start Event
            </Button>
          </div>
        )}

        {isOrganizer && event.status === 'started' && (
          <div className="flex justify-end gap-4">
            <Button 
              onClick={handleStartEvent} 
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Reshuffle Pods
            </Button>
            <Button 
              onClick={handleResetEvent} 
              variant="destructive"
            >
              Reset to Lobby
            </Button>
          </div>
        )}

        {/* Content Area */}
        {event.status === 'lobby' ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Lobby ({players.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {players.map((player) => (
                    <div key={player.id} className="flex items-center justify-between bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-400">
                          {player.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{player.displayName}</p>
                          {player.isOrganizer && <span className="text-xs text-blue-400">Organizer</span>}
                        </div>
                      </div>
                      {isOrganizer && !player.isOrganizer && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(player)} className="h-8 w-8 text-zinc-500 hover:text-white">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleRemovePlayer(player.id)} className="h-8 w-8 text-zinc-500 hover:text-red-400">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {players.length === 0 && (
                    <div className="col-span-full text-center py-8 text-zinc-500">
                      Waiting for players to join...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.5, type: 'spring' }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6" /> Pairings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {event.pods && JSON.parse(event.pods).map((pod: any, index: number) => (
                <motion.div 
                  key={pod.podNumber}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                >
                  <Card className="bg-zinc-900 border-zinc-800 text-zinc-50 overflow-hidden">
                    <div className="bg-zinc-950 px-6 py-3 border-b border-zinc-800 flex justify-between items-center">
                      <h3 className="font-bold text-lg">Pod {pod.podNumber}</h3>
                      <Badge variant="outline" className="text-zinc-400 border-zinc-700">{pod.playerIds.length} Players</Badge>
                    </div>
                    <CardContent className="p-0">
                      <ul className="divide-y divide-zinc-800">
                        {pod.playerIds.map((playerId: string) => {
                          const player = players.find(p => p.id === playerId);
                          return (
                            <li key={playerId} className="px-6 py-4 flex items-center gap-3 hover:bg-zinc-800/50 transition-colors">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-400 text-sm">
                                {player?.displayName?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <span className="font-medium">{player?.displayName || 'Unknown Player'}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Edit Player Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>Edit Player Name</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditPlayerSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Display Name</Label>
              <Input 
                id="editName" 
                value={editPlayerName} 
                onChange={(e) => setEditPlayerName(e.target.value)}
                className="bg-zinc-950 border-zinc-800"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Player Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>Add Player Manually</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPlayerSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="newName">Player Name</Label>
              <Input 
                id="newName" 
                value={newPlayerName} 
                onChange={(e) => setNewPlayerName(e.target.value)}
                className="bg-zinc-950 border-zinc-800"
                placeholder="e.g. John Doe"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Add Player</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
