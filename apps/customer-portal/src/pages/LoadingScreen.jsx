import { useEffect, useState } from 'react';

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-espro-orange via-orange-500 to-orange-600 flex flex-col items-center justify-center p-6" style={{ borderRadius: '24px' }}>
      <div className="text-center text-white">
        {/* Logo Icon */}
        <div className="w-30 h-30 bg-white/20 backdrop-blur-lg rounded-full mx-auto mb-8 flex items-center justify-center" style={{ width: '120px', height: '120px' }}>
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
            <div className="text-espro-orange text-4xl font-bold">E</div>
          </div>
        </div>
        
        {/* Brand Text */}
        <div className="text-2xl font-bold mb-2 tracking-tight" style={{ letterSpacing: '2px' }}>ESPRO</div>
        <div className="text-base opacity-90 tracking-wider" style={{ letterSpacing: '1px' }}>Collective</div>
        
        {/* Loading Bar */}
        <div className="mt-12 w-10 h-1 bg-white/30 rounded-full overflow-hidden mx-auto">
          <div
            className="h-full bg-white rounded-full transition-all duration-300"
            style={{ width: '60%', animation: 'loading 1.5s ease-in-out infinite' }}
          />
        </div>
      </div>
      
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}

