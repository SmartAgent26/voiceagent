import React, { useEffect, useState } from 'react';

export default function AudioVisualizer({ isRecording, isPlaying }) {
  const [bars, setBars] = useState(Array(15).fill(20));

  useEffect(() => {
    let interval = null;
    if (isRecording || isPlaying) {
      interval = setInterval(() => {
        // Simular rebotes de frecuencia aleatorios para la onda de audio
        setBars(Array(15).fill(0).map(() => Math.floor(Math.random() * 60) + 15));
      }, 100);
    } else {
      setBars(Array(15).fill(12));
    }
    return () => clearInterval(interval);
  }, [isRecording, isPlaying]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 my-6 p-4">
      {/* 1. Orbe de Voz reactivo */}
      <div 
        className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500
          ${isRecording 
            ? 'voice-core-active bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500' 
            : isPlaying 
              ? 'voice-core-active bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-500'
              : 'bg-gradient-to-tr from-indigo-900 to-slate-800 border border-slate-700 shadow-inner'
          }`}
        style={{
          boxShadow: isRecording 
            ? '0 0 40px rgba(168, 85, 247, 0.4)' 
            : isPlaying 
              ? '0 0 40px rgba(59, 130, 246, 0.4)'
              : 'none'
        }}
      >
        <div className="w-28 h-28 rounded-full bg-slate-950 flex items-center justify-center border border-white/5">
          <span className="text-sm font-medium text-slate-400">
            {isRecording ? 'Escuchando...' : isPlaying ? 'Hablando...' : 'Listo'}
          </span>
        </div>
      </div>

      {/* 2. Onda de Audio SVG (Onda Bouncing) */}
      <div className="flex items-center justify-center gap-1.5 h-16 w-60">
        {bars.map((height, index) => (
          <div
            key={index}
            className="audio-wave-bar"
            style={{
              height: `${height}px`,
              opacity: isRecording || isPlaying ? 0.9 - (Math.abs(7 - index) * 0.08) : 0.25,
              animation: isRecording || isPlaying ? `wave-bounce 0.8s infinite ease-in-out` : 'none',
              animationDelay: `${index * 0.06}s`,
              transition: 'height 0.1s ease'
            }}
          />
        ))}
      </div>
    </div>
  );
}
