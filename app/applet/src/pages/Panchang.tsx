import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { KundliCanvas } from '../components/panchang/KundliCanvas';
import { MuhuratTimeline } from '../components/panchang/MuhuratTimeline';
import { Calendar, Sunrise, Sunset, Moon, Star, Sparkles } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';

export default function PanchangDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Mock Planetary Data for North Indian Chart
  // 1st house is top-center. Houses go counter-clockwise.
  const chartHouses = [
    'Su, Me', // 1st House (Ascendant)
    '',       // 2nd
    'Ma',     // 3rd
    '',       // 4th
    'Ju',     // 5th
    '',       // 6th
    'Mo',     // 7th
    'Ke',     // 8th
    '',       // 9th
    'Sa',     // 10th
    'Ve',     // 11th
    'Ra'      // 12th
  ];

  const ascendantSign = 5; // Leo Ascendant

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8 font-sans">
      
      {/* Header & Date Selector */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-headline font-extrabold tracking-tight text-foreground flex items-center gap-2">
            Vedic Panchang <Sparkles className="text-amber-500 w-6 h-6" />
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Local celestial insights and daily astrology
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-card/40 backdrop-blur-xl border rounded-full px-4 py-2 shadow-sm">
          <Calendar className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8">
        
        {/* Left Column: Core Daily Data & Chart */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Tithi & Nakshatra Hero Card (Glassmorphism) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-white/20 dark:border-white/5 backdrop-blur-2xl p-6 shadow-lg"
          >
            {/* Background glowing orb */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-1">Current Tithi</h2>
                <div className="text-3xl md:text-4xl font-headline font-bold text-foreground">Shukla Navami</div>
                <div className="text-sm text-muted-foreground mt-2 font-medium">Valid until 04:32 PM</div>
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-1">Nakshatra</h2>
                <div className="text-3xl md:text-4xl font-headline font-bold text-foreground flex items-center gap-2">
                  Pushya <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                </div>
                <div className="text-sm text-muted-foreground mt-2 font-medium">Valid until 08:15 AM tomorrow</div>
              </div>
            </div>
          </motion.div>

          {/* Sun & Moon Cycle Carousel */}
          <div className="grid grid-cols-2 gap-4">
             <Card className="bg-card/50 backdrop-blur-lg border-white/10 shadow-sm border-none">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                    <Sunrise className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sunrise</p>
                    <p className="text-xl font-bold text-foreground">06:14 AM</p>
                  </div>
                </CardContent>
             </Card>
             <Card className="bg-card/50 backdrop-blur-lg border-white/10 shadow-sm border-none">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                    <Moon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Moonrise</p>
                    <p className="text-xl font-bold text-foreground">07:22 PM</p>
                  </div>
                </CardContent>
             </Card>
          </div>

          {/* Kundli Chart Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-card/30 backdrop-blur-xl border rounded-3xl p-6 md:p-8 shadow-sm flex flex-col items-center"
          >
            <div className="w-full flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold font-headline">Lagna Kundli</h3>
                <p className="text-sm text-muted-foreground">Current Planetary Positions</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                Leo Ascendant
              </div>
            </div>
            
            <div className="w-full flex justify-center py-4">
               <KundliCanvas size={320} houses={chartHouses} ascendant={ascendantSign} />
            </div>
          </motion.div>

        </div>

        {/* Right Column: Muhurat Timeline */}
        <div className="lg:col-span-5">
          <div className="bg-card/30 backdrop-blur-xl border rounded-3xl p-6 h-full shadow-sm">
             <div className="mb-6">
                <h3 className="text-xl font-bold font-headline text-foreground">Choghadiya & Muhurat</h3>
                <p className="text-sm text-muted-foreground">Auspicious timings for the day</p>
             </div>
             
             <div className="h-[calc(100vh-280px)] overflow-y-auto pr-2 custom-scrollbar">
               <MuhuratTimeline />
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
