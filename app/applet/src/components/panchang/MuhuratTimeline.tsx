import React from 'react';
import { motion } from 'framer-motion';

interface MuhuratEvent {
  id: string;
  time: string;
  title: string;
  type: 'auspicious' | 'inauspicious' | 'neutral';
  description: string;
}

const timelineData: MuhuratEvent[] = [
  { id: 'm1', time: '06:14 AM - 07:52 AM', title: 'Brahma Muhurat', type: 'auspicious', description: 'Ideal for meditation and spiritual practices.' },
  { id: 'm2', time: '10:30 AM - 12:00 PM', title: 'Rahu Kalam', type: 'inauspicious', description: 'Avoid starting new ventures.' },
  { id: 'm3', time: '12:04 PM - 12:56 PM', title: 'Abhijit Muhurat', type: 'auspicious', description: 'Most auspicious time of the day.' },
  { id: 'm4', time: '03:00 PM - 04:30 PM', title: 'Gulikai Kalam', type: 'neutral', description: 'General activities are fine.' },
  { id: 'm5', time: '06:15 PM - 07:45 PM', title: 'Pradosh Kaal', type: 'auspicious', description: 'Evening prayers and rituals.' },
];

export const MuhuratTimeline: React.FC = () => {
  return (
    <div className="relative pl-6 py-4">
      {/* Vertical Line */}
      <div className="absolute top-0 bottom-0 left-[27px] w-[2px] bg-gradient-to-b from-primary/10 via-primary/40 to-primary/10" />

      <div className="space-y-8 relative">
        {timelineData.map((event, index) => (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
            key={event.id} 
            className="relative flex items-start gap-4"
          >
            {/* Timeline Dot */}
            <div className="relative z-10 flex-shrink-0 mt-1.5">
              <div className={`w-3 h-3 rounded-full border-2 bg-background
                ${event.type === 'auspicious' ? 'border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 
                  event.type === 'inauspicious' ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 
                  'border-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]'}`} 
              />
            </div>

            {/* Content Card (Glassmorphism) */}
            <div className="flex-1 bg-background/40 backdrop-blur-md border border-white/10 dark:border-white/5 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <span className="text-xs font-semibold text-primary tracking-wider uppercase">{event.time}</span>
              <h4 className="text-base font-bold text-foreground mt-1 mb-1">{event.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
