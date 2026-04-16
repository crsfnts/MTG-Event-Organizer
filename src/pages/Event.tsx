import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, setDoc, updateDoc, deleteDoc, serverTimestamp, getDoc, deleteField } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Copy, Check, Play, RefreshCw, Trash2, Edit2, UserPlus, Trophy, Clock, ChevronRight, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
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
  const [directJoinName, setDirectJoinName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [roundTimeLeft, setRoundTimeLeft] = useState<string>('');
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [timerInputMinutes, setTimerInputMinutes] = useState('50');
  const [timerTarget, setTimerTarget] = useState<'draft' | 'round'>('draft');
  const draftChimePlayed = useRef(false);
  const roundChimePlayed = useRef(false);

  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.1); // E6
      
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.5);
      
      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

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
    const interval = setInterval(() => {
      const now = Date.now();
      
      if (event?.status === 'drafting' && event?.draftEndTime) {
        const distance = event.draftEndTime - now;
        if (distance <= 0) {
          setTimeLeft('00:00');
          if (!draftChimePlayed.current) {
            playChime();
            draftChimePlayed.current = true;
          }
        } else {
          draftChimePlayed.current = false;
          const minutes = Math.floor(distance / 60000);
          const seconds = Math.floor((distance % 60000) / 1000);
          setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }

      if (event?.status === 'started' && event?.roundEndTime) {
        const distance = event.roundEndTime - now;
        if (distance <= 0) {
          setRoundTimeLeft('00:00');
          if (!roundChimePlayed.current) {
            playChime();
            roundChimePlayed.current = true;
          }
        } else {
          roundChimePlayed.current = false;
          const minutes = Math.floor(distance / 60000);
          const seconds = Math.floor((distance % 60000) / 1000);
          setRoundTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [event?.status, event?.draftEndTime, event?.roundEndTime]);

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

  const handleSetTimer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !isOrganizer) return;
    const minutes = parseInt(timerInputMinutes);
    if (isNaN(minutes) || minutes <= 0) return;

    try {
      const updateData: any = {};
      if (timerTarget === 'draft') {
        updateData.draftEndTime = Date.now() + minutes * 60000;
        draftChimePlayed.current = false;
      } else {
        updateData.roundEndTime = Date.now() + minutes * 60000;
        roundChimePlayed.current = false;
      }
      await updateDoc(doc(db, 'events', eventId), updateData);
      setIsTimerModalOpen(false);
    } catch (error) {
      console.error("Error setting timer:", error);
    }
  };

  const copyToClipboard = () => {
    if (eventId) {
      navigator.clipboard.writeText(eventId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartEvent = async () => {
    if (!eventId || !isOrganizer) return;
    
    if (event.status === 'lobby' && event.format === 'Draft') {
      try {
        await updateDoc(doc(db, 'events', eventId), {
          status: 'drafting',
          draftEndTime: Date.now() + 45 * 60 * 1000 // 45 minutes
        });
      } catch (error) {
        console.error("Error starting draft:", error);
      }
      return;
    }

    // Generate pods
    const chunkSize = event.format === 'Commander' ? 4 : 2;
    let shuffledPlayers = [...players].sort(() => 0.5 - Math.random());
    let pods = [];
    let podCount = 1;
    
    while (shuffledPlayers.length > 0) {
      pods.push({
        podNumber: podCount++,
        playerIds: shuffledPlayers.splice(0, chunkSize).map(p => p.id),
        winnerIds: []
      });
    }

    try {
      await updateDoc(doc(db, 'events', eventId), {
        status: 'started',
        round: 1,
        pastRounds: '[]',
        pods: JSON.stringify(pods),
        roundEndTime: Date.now() + 50 * 60000 // 50 minutes
      });
    } catch (error) {
      console.error("Error starting event:", error);
    }
  };

  const handleNextRound = async () => {
    if (!eventId || !isOrganizer || !event.pods) return;
    
    try {
      const currentPods = JSON.parse(event.pods);
      const pastRounds = event.pastRounds ? JSON.parse(event.pastRounds) : [];
      const newPastRounds = [...pastRounds, currentPods];
      
      const currentRound = event.round || 1;
      
      // Calculate standings to pair next round
      const points: Record<string, number> = {};
      players.forEach(p => points[p.id] = 0);
      
      newPastRounds.forEach(round => {
        round.forEach((pod: any) => {
          if (pod.winnerIds) {
            pod.winnerIds.forEach((wId: string) => {
              if (points[wId] !== undefined) points[wId] += 3;
            });
          }
        });
      });
      
      const standings = [...players].sort((a, b) => points[b.id] - points[a.id]);
      
      // Generate new pods
      const chunkSize = event.format === 'Commander' ? 4 : 2;
      let toPair = [...standings];
      let newPods = [];
      let podCount = 1;
      
      while (toPair.length > 0) {
        newPods.push({
          podNumber: podCount++,
          playerIds: toPair.splice(0, chunkSize).map(p => p.id),
          winnerIds: []
        });
      }
      
      await updateDoc(doc(db, 'events', eventId), {
        round: currentRound + 1,
        pods: JSON.stringify(newPods),
        pastRounds: JSON.stringify(newPastRounds),
        roundEndTime: Date.now() + 50 * 60000 // 50 minutes
      });
      
    } catch (error) {
      console.error("Error generating next round:", error);
    }
  };

  const calculateStandings = () => {
    if (!event) return [];
    const points: Record<string, number> = {};
    players.forEach(p => points[p.id] = 0);
    
    const pastRounds = event.pastRounds ? JSON.parse(event.pastRounds) : [];
    const currentPods = event.pods ? JSON.parse(event.pods) : [];
    
    const allRounds = [...pastRounds, currentPods];
    
    allRounds.forEach(round => {
      round.forEach((pod: any) => {
        if (pod.winnerIds) {
          pod.winnerIds.forEach((wId: string) => {
            if (points[wId] !== undefined) points[wId] += 3;
          });
        }
      });
    });
    
    return players.map(p => ({
      ...p,
      points: points[p.id] || 0
    })).sort((a, b) => b.points - a.points);
  };

  const handleToggleWinner = async (podNumber: number, playerId: string) => {
    if (!eventId || !isOrganizer || !event.pods) return;
    
    try {
      const currentPods = JSON.parse(event.pods);
      const updatedPods = currentPods.map((pod: any) => {
        if (pod.podNumber === podNumber) {
          const isWinner = pod.winnerIds?.includes(playerId);
          let newWinners = pod.winnerIds || [];
          if (isWinner) {
            newWinners = newWinners.filter((id: string) => id !== playerId);
          } else {
            newWinners = [...newWinners, playerId];
          }
          return { ...pod, winnerIds: newWinners };
        }
        return pod;
      });

      await updateDoc(doc(db, 'events', eventId), {
        pods: JSON.stringify(updatedPods)
      });
    } catch (error) {
      console.error("Error toggling winner:", error);
    }
  };

  const handleResetEvent = async () => {
    if (!eventId || !isOrganizer) return;
    try {
      await updateDoc(doc(db, 'events', eventId), {
        status: 'lobby',
        pods: deleteField(),
        round: deleteField(),
        pastRounds: deleteField(),
        roundEndTime: deleteField(),
        draftEndTime: deleteField()
      });
    } catch (error) {
      console.error("Error resetting event:", error);
    }
  };

  const handleRemovePlayer = async () => {
    if (!eventId || !isOrganizer || !playerToDelete) return;
    try {
      await deleteDoc(doc(db, 'events', eventId, 'players', playerToDelete));
      setPlayerToDelete(null);
    } catch (error) {
      console.error("Error removing player:", error);
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

  const handleDirectJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !auth.currentUser || !directJoinName) return;
    setIsJoining(true);
    try {
      await setDoc(doc(db, 'events', eventId, 'players', auth.currentUser.uid), {
        id: auth.currentUser.uid,
        eventId: eventId,
        displayName: directJoinName,
        joinedAt: serverTimestamp(),
        isOrganizer: false,
      });
    } catch (error) {
      console.error("Error joining:", error);
    } finally {
      setIsJoining(false);
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

  const isPlayer = players.some(p => p.id === auth.currentUser?.uid);
  
  if (!isOrganizer && !isPlayer) {
    if (event.status !== 'lobby') {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-center p-8">
            <h2 className="text-2xl font-bold mb-2">Event Started</h2>
            <p className="text-zinc-400">This event has already started and is no longer accepting new players.</p>
            <Button onClick={() => navigate('/')} className="mt-6 bg-zinc-800 hover:bg-zinc-700 text-white">Return Home</Button>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-zinc-50">
          <CardHeader>
            <CardTitle>Join {event.name}</CardTitle>
            <CardDescription className="text-zinc-400">Enter your name to join this event.</CardDescription>
          </CardHeader>
          <form onSubmit={handleDirectJoin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="directJoinName">Your Name</Label>
                <Input 
                  id="directJoinName" 
                  placeholder="Display Name" 
                  value={directJoinName} 
                  onChange={(e) => setDirectJoinName(e.target.value)}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isJoining} className="w-full h-12 text-base border-none bg-[#0693e3] hover:bg-[#003388] text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                {isJoining ? 'Joining...' : 'Join Event'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  const joinUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation */}
        <div>
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')} 
            className="text-zinc-400 hover:text-white hover:bg-zinc-900 -ml-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
          </Button>
        </div>

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
              className="h-11 px-6 border-none bg-[#ffc72c] hover:bg-[#ffbe18] text-zinc-950 font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
            >
              <UserPlus className="w-4 h-4 mr-2" /> Add Player
            </Button>
            <Button 
              onClick={handleStartEvent} 
              disabled={players.length < 2}
              className="h-11 px-8 border-none bg-[#0693e3] hover:bg-[#003388] text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
            >
              <Play className="w-4 h-4 mr-2" /> {event.format === 'Draft' ? 'Start Draft' : 'Start Event'}
            </Button>
          </div>
        )}

        {isOrganizer && event.status === 'started' && (
          <div className="flex justify-end gap-4">
            <Button 
              onClick={handleStartEvent} 
              className="border-none bg-[#ffc72c] hover:bg-[#ffbe18] text-black hover:text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
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
                          <Button variant="ghost" size="icon" onClick={() => setPlayerToDelete(player.id)} className="h-8 w-8 text-zinc-500 hover:text-red-400">
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
        ) : event.status === 'drafting' ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, type: 'spring' }}>
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-50 text-center py-12">
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <div className="w-24 h-24 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-700">
                    <Clock className="w-10 h-10 text-[#ffc72c]" />
                  </div>
                </div>
                <div>
                  <h2 className="text-3xl font-bold mb-2">Draft in Progress</h2>
                  <p className="text-zinc-400">Players are currently drafting their decks.</p>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <div className="text-6xl font-mono font-bold tracking-tight text-white">
                    {timeLeft || '00:00'}
                  </div>
                  {isOrganizer && (
                    <Button variant="outline" size="sm" onClick={() => { setTimerTarget('draft'); setIsTimerModalOpen(true); }} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                      Set Timer
                    </Button>
                  )}
                </div>
                {isOrganizer && (
                  <div className="pt-8">
                    <Button onClick={handleStartEvent} className="h-14 px-8 border-none bg-[#0693e3] hover:bg-[#003388] text-white font-semibold text-lg rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                      End Draft & Generate Pairings <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.5, type: 'spring' }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-xl border border-zinc-800 mb-2">
                <div className="flex items-center gap-4">
                  <Clock className="w-6 h-6 text-[#ffc72c]" />
                  <span className="text-3xl font-mono font-bold">{roundTimeLeft || '00:00'}</span>
                </div>
                {isOrganizer && (
                  <Button variant="outline" onClick={() => { setTimerTarget('round'); setIsTimerModalOpen(true); }} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                    Set Timer
                  </Button>
                )}
              </div>
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Users className="w-6 h-6" /> Round {event.round || 1} Pairings
                </h2>
                {isOrganizer && (
                  <Button 
                    onClick={handleNextRound}
                    className="h-10 px-4 border-none bg-[#ffc72c] hover:bg-[#ffbe18] text-black hover:text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                  >
                    Next Round <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {event.pods && JSON.parse(event.pods).map((pod: any, index: number) => (
                  <motion.div 
                    key={pod.podNumber}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 + 0.2 }}
                  >
                    <Card className="bg-zinc-900 border-zinc-800 text-zinc-50 overflow-hidden h-full flex flex-col">
                      <div className="bg-zinc-950 px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          Table {pod.podNumber}
                        </h3>
                        <Badge variant="outline" className="text-zinc-400 border-zinc-700 bg-zinc-900">{pod.playerIds.length} Players</Badge>
                      </div>
                      <CardContent className="p-0 flex-1">
                        <ul className="divide-y divide-zinc-800/50">
                          {pod.playerIds.map((playerId: string) => {
                            const player = players.find(p => p.id === playerId);
                            const isWinner = pod.winnerIds?.includes(playerId);
                            return (
                              <li 
                                key={playerId} 
                                onClick={() => isOrganizer && handleToggleWinner(pod.podNumber, playerId)}
                                className={`px-6 py-4 flex items-center justify-between transition-colors ${isOrganizer ? 'cursor-pointer hover:bg-zinc-800/50' : ''} ${isWinner ? 'bg-[#ffc72c]/10' : ''}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isWinner ? 'bg-[#ffc72c] text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}>
                                    {player?.displayName?.charAt(0).toUpperCase() || '?'}
                                  </div>
                                  <span className={`font-medium ${isWinner ? 'text-[#ffc72c]' : 'text-zinc-200'}`}>
                                    {player?.displayName || 'Unknown Player'}
                                  </span>
                                </div>
                                {isWinner && <Trophy className="w-5 h-5 text-[#ffc72c]" />}
                              </li>
                            );
                          })}
                        </ul>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
            
            <div className="lg:col-span-1 space-y-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Trophy className="w-6 h-6" /> Standings
              </h2>
              <Card className="bg-zinc-900 border-zinc-800 text-zinc-50 overflow-hidden">
                <CardContent className="p-0">
                  <ul className="divide-y divide-zinc-800/50">
                    {calculateStandings().map((player, index) => (
                      <li key={player.id} className="px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-zinc-500 font-mono w-4">{index + 1}.</span>
                          <span className="font-medium text-zinc-200">{player.displayName}</span>
                        </div>
                        <span className="font-bold text-[#ffc72c]">{player.points} pts</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
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
              <Button type="submit" className="border-none bg-[#0693e3] hover:bg-[#003388] text-white">Save Changes</Button>
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
              <Button type="submit" className="border-none bg-[#ffc72c] hover:bg-[#ffbe18] text-zinc-950 font-semibold">Add Player</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!playerToDelete} onOpenChange={(open) => !open && setPlayerToDelete(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>Remove Player</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to remove this player from the event? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setPlayerToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemovePlayer}>Remove Player</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Timer Modal */}
      <Dialog open={isTimerModalOpen} onOpenChange={setIsTimerModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>Set Timer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSetTimer} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="timerMinutes">Minutes</Label>
              <Input 
                id="timerMinutes" 
                type="number"
                value={timerInputMinutes} 
                onChange={(e) => setTimerInputMinutes(e.target.value)}
                className="bg-zinc-950 border-zinc-800"
                min="1"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsTimerModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="border-none bg-[#0693e3] hover:bg-[#003388] text-white">Start Timer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
