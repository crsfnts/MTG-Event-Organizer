import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Hash, User, Trophy, Swords, Users } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  
  const [eventName, setEventName] = useState('');
  const [eventFormat, setEventFormat] = useState('Commander');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName || !auth.currentUser) {
      if (!auth.currentUser) alert("Authentication failed or is still initializing. If you are using an incognito window or Safari, please open the app in a new tab to allow authentication.");
      return;
    }
    
    setIsCreating(true);
    try {
      // Generate a short 6-character alphanumeric code
      const eventId = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const eventData: any = {
        id: eventId,
        name: eventName,
        format: eventFormat,
        status: 'lobby',
        createdAt: serverTimestamp(),
        organizerId: auth.currentUser.uid,
      };
      
      if (maxPlayers) {
        eventData.maxPlayers = parseInt(maxPlayers);
      }
      
      await setDoc(doc(db, 'events', eventId), eventData);

      navigate(`/event/${eventId}`);
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode || !joinName) return;
    
    // Pass the name via state to the event page
    navigate(`/event/${joinCode.toUpperCase()}`, { state: { playerName: joinName } });
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 font-sans">
      <div className="text-center mb-10">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-4 drop-shadow-lg">MTG Event Generator</h1>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] w-full max-w-md p-8 md:p-10 relative overflow-hidden">
        {mode === 'join' ? (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-extrabold text-zinc-900 mb-2">Join Event</h2>
            <p className="text-zinc-500 mb-8 font-medium">Enter code to join the lobby</p>

            <form onSubmit={handleJoinEvent} className="w-full space-y-5">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Hash className="h-5 w-5 text-[#0693e3]" />
                </div>
                <Input
                  id="joinCode"
                  placeholder="Event Code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="pl-14 h-14 rounded-full bg-white border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] text-zinc-900 text-lg focus-visible:ring-2 focus-visible:ring-[#0693e3]/50 uppercase placeholder:text-zinc-400 placeholder:normal-case transition-shadow"
                  required
                />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-[#0693e3]" />
                </div>
                <Input
                  id="joinName"
                  placeholder="Display Name"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  className="pl-14 h-14 rounded-full bg-white border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] text-zinc-900 text-lg focus-visible:ring-2 focus-visible:ring-[#0693e3]/50 placeholder:text-zinc-400 transition-shadow"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-14 mt-4 rounded-full border-none bg-[#0693e3] hover:bg-[#003388] text-white text-lg font-bold shadow-[0_8px_20px_rgba(6,147,227,0.4)] hover:shadow-[0_12px_25px_rgba(6,147,227,0.5)] transition-all duration-300 hover:-translate-y-1"
              >
                JOIN EVENT
              </Button>
            </form>

            <p className="mt-8 text-zinc-500 font-medium">
              Want to host a tournament?{' '}
              <button type="button" onClick={() => setMode('create')} className="text-[#0693e3] font-bold hover:underline transition-colors">
                Create
              </button>
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-extrabold text-zinc-900 mb-2">Create Event</h2>
            <p className="text-zinc-500 mb-8 font-medium">Host a new tournament</p>

            <form onSubmit={handleCreateEvent} className="w-full space-y-5">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Trophy className="h-5 w-5 text-[#ffc72c]" />
                </div>
                <Input
                  id="eventName"
                  placeholder="Event Name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="pl-14 h-14 rounded-full bg-white border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] text-zinc-900 text-lg focus-visible:ring-2 focus-visible:ring-[#ffc72c]/50 placeholder:text-zinc-400 transition-shadow"
                  required
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
                  <Swords className="h-5 w-5 text-[#ffc72c]" />
                </div>
                <Select value={eventFormat} onValueChange={setEventFormat}>
                  <SelectTrigger className="pl-14 h-14 rounded-full bg-white border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] text-zinc-900 text-lg focus:ring-2 focus:ring-[#ffc72c]/50 transition-shadow">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-zinc-100 text-zinc-900 rounded-2xl shadow-xl">
                    <SelectItem value="Commander" className="focus:bg-zinc-100 cursor-pointer">Commander</SelectItem>
                    <SelectItem value="Draft" className="focus:bg-zinc-100 cursor-pointer">Draft</SelectItem>
                    <SelectItem value="Standard" className="focus:bg-zinc-100 cursor-pointer">Standard</SelectItem>
                    <SelectItem value="Modern" className="focus:bg-zinc-100 cursor-pointer">Modern</SelectItem>
                    <SelectItem value="Pioneer" className="focus:bg-zinc-100 cursor-pointer">Pioneer</SelectItem>
                    <SelectItem value="Custom" className="focus:bg-zinc-100 cursor-pointer">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Users className="h-5 w-5 text-[#ffc72c]" />
                </div>
                <Input
                  id="maxPlayers"
                  type="number"
                  placeholder="Max Players (Optional)"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                  className="pl-14 h-14 rounded-full bg-white border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] text-zinc-900 text-lg focus-visible:ring-2 focus-visible:ring-[#ffc72c]/50 placeholder:text-zinc-400 transition-shadow"
                  min="2"
                />
              </div>

              <Button
                type="submit"
                disabled={isCreating}
                className="w-full h-14 mt-4 rounded-full border-none bg-[#ffc72c] hover:bg-[#ffbe18] text-zinc-950 text-lg font-bold shadow-[0_8px_20px_rgba(255,199,44,0.4)] hover:shadow-[0_12px_25px_rgba(255,199,44,0.5)] transition-all duration-300 hover:-translate-y-1"
              >
                {isCreating ? 'CREATING...' : 'CREATE EVENT'}
              </Button>
            </form>

            <p className="mt-8 text-zinc-500 font-medium">
              Looking for a tournament?{' '}
              <button type="button" onClick={() => setMode('join')} className="text-[#ffc72c] font-bold hover:underline transition-colors">
                Join
              </button>
            </p>
          </div>
        )}
      </div>

      <div className="pt-12 text-center space-y-2">
        <p className="text-zinc-500 text-sm font-medium">Created by Chris Fuentes</p>
        <p className="text-zinc-600 text-xs max-w-md mx-auto leading-relaxed">
          Disclaimer: This app may cause spontaneous urges to tap islands, counter spells, and spend excessive amounts of money on shiny cardboard. Use at your own risk.
        </p>
      </div>
    </div>
  );
}
