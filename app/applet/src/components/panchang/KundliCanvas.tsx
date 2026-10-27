import React, { useEffect, useRef } from 'react';

interface KundliCanvasProps {
  size?: number;
  houses: string[]; // Planets in each house
  ascendant: number;
}

export const KundliCanvas: React.FC<KundliCanvasProps> = ({ size = 300, houses, ascendant }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI Canvas setup
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Styling
    ctx.strokeStyle = 'currentColor'; // Use current text color for dark/light mode support
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    
    // Draw outer square
    ctx.strokeRect(0, 0, size, size);

    // Draw diagonals
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size, size);
    ctx.moveTo(size, 0);
    ctx.lineTo(0, size);
    ctx.stroke();

    // Draw inner diamond
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size, size / 2);
    ctx.lineTo(size / 2, size);
    ctx.lineTo(0, size / 2);
    ctx.closePath();
    ctx.stroke();

    // Center coordinates for the 12 houses (approximate for text placement)
    const padding = 20;
    const houseCenters = [
      { x: size / 2, y: size / 4 }, // 1st house (Top Center)
      { x: size / 4, y: size / 8 }, // 2nd house
      { x: size / 8, y: size / 4 }, // 3rd house
      { x: size / 4, y: size / 2 }, // 4th house
      { x: size / 8, y: size * 3 / 4 }, // 5th house
      { x: size / 4, y: size * 7 / 8 }, // 6th house
      { x: size / 2, y: size * 3 / 4 }, // 7th house
      { x: size * 3 / 4, y: size * 7 / 8 }, // 8th house
      { x: size * 7 / 8, y: size * 3 / 4 }, // 9th house
      { x: size * 3 / 4, y: size / 2 }, // 10th house
      { x: size * 7 / 8, y: size / 4 }, // 11th house
      { x: size * 3 / 4, y: size / 8 }, // 12th house
    ];

    // Draw text for planets and signs
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '12px "Inter", sans-serif';
    
    // Draw house numbers (Signs based on ascendant)
    ctx.fillStyle = '#888888'; // muted color
    houseCenters.forEach((center, index) => {
      const signNum = ((ascendant - 1 + index) % 12) + 1;
      // Offset slightly for sign number
      ctx.fillText(signNum.toString(), center.x, center.y + 15);
    });

    // Draw planets
    ctx.fillStyle = 'currentColor'; // primary text color
    ctx.font = 'bold 14px "Inter", sans-serif';
    houses.forEach((planets, index) => {
      if (planets) {
        ctx.fillText(planets, houseCenters[index].x, houseCenters[index].y - 5);
      }
    });

  }, [size, houses, ascendant]);

  return (
    <div className="relative flex justify-center items-center w-full aspect-square max-w-[300px] mx-auto text-primary">
      <canvas ref={canvasRef} className="opacity-90 drop-shadow-md transition-all duration-300" />
    </div>
  );
};
