import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const navigate = useNavigate();
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
      
      // Also add the organizer as a player
      await setDoc(doc(db, 'events', eventId, 'players', auth.currentUser.uid), {
        id: auth.currentUser.uid,
        eventId: eventId,
        displayName: 'Organizer',
        joinedAt: serverTimestamp(),
        isOrganizer: true,
      });

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
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Tabletop Tourney</h1>
          <p className="text-zinc-400">Create or join an event to get started.</p>
        </div>

        <div className="grid gap-8">
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-50">
            <CardHeader>
              <CardTitle>Join Event</CardTitle>
              <CardDescription className="text-zinc-400">Enter an event code to join as a player.</CardDescription>
            </CardHeader>
            <form onSubmit={handleJoinEvent}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="joinCode">Event Code</Label>
                  <Input 
                    id="joinCode" 
                    placeholder="e.g. A1B2C3" 
                    value={joinCode} 
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 uppercase"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="joinName">Your Name</Label>
                  <Input 
                    id="joinName" 
                    placeholder="Display Name" 
                    value={joinName} 
                    onChange={(e) => setJoinName(e.target.value)}
                    className="bg-zinc-950 border-zinc-800"
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">Join Event</Button>
              </CardFooter>
            </form>
          </Card>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-950 px-2 text-zinc-500">Or</span>
            </div>
          </div>

          <Card className="bg-zinc-900 border-zinc-800 text-zinc-50">
            <CardHeader>
              <CardTitle>Create Event</CardTitle>
              <CardDescription className="text-zinc-400">Host a new tournament as an organizer.</CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateEvent}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="eventName">Event Name</Label>
                  <Input 
                    id="eventName" 
                    placeholder="Friday Night Magic" 
                    value={eventName} 
                    onChange={(e) => setEventName(e.target.value)}
                    className="bg-zinc-950 border-zinc-800"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventFormat">Format</Label>
                  <Select value={eventFormat} onValueChange={setEventFormat}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-50">
                      <SelectItem value="Commander">Commander</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Modern">Modern</SelectItem>
                      <SelectItem value="Pioneer">Pioneer</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxPlayers">Max Players (Optional)</Label>
                  <Input 
                    id="maxPlayers" 
                    type="number" 
                    placeholder="Leave empty for unlimited" 
                    value={maxPlayers} 
                    onChange={(e) => setMaxPlayers(e.target.value)}
                    className="bg-zinc-950 border-zinc-800"
                    min="2"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isCreating} className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-300">
                  {isCreating ? 'Creating...' : 'Create Event'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
