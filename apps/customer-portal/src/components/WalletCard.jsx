import { useState } from 'react';
import useAuthStore from '../store/authStore';
import { formatEsproCoinsDisplay } from '../utils/format';
import { getBaseApiUrl } from '../utils/api';
import { useIsMobile } from '../hooks/useIsMobile';

export default function WalletCard() {
  const { user } = useAuthStore();
  const [isFlipped, setIsFlipped] = useState(false);
  const isMobile = useIsMobile();

  const cardDesign = user?.activeCardDesign || {
    gradientColors: { primary: '#f66633', secondary: '#ff8c64' },
    designType: 'gradient',
    textColor: '#FFFFFF',
  };

  // Construct full image URL for front - use mobile image on small screens if available
  const baseImageUrl = isMobile && cardDesign.mobileImageUrl 
    ? cardDesign.mobileImageUrl 
    : cardDesign.imageUrl;
  
  const imageUrl = baseImageUrl 
    ? (baseImageUrl.startsWith('http://') || baseImageUrl.startsWith('https://')
        ? baseImageUrl 
        : `${getBaseApiUrl()}${baseImageUrl}`)
    : null;

  // Construct full image URL for back
  const backImageUrl = cardDesign.backCardImageUrl 
    ? (cardDesign.backCardImageUrl.startsWith('http://') || cardDesign.backCardImageUrl.startsWith('https://')
        ? cardDesign.backCardImageUrl 
        : `${getBaseApiUrl()}${cardDesign.backCardImageUrl}`)
    : null;

  // Front card style
  const cardStyle =
    (cardDesign.designType === 'image' || cardDesign.designType === 'reward') && imageUrl
      ? { 
          backgroundImage: `url(${imageUrl})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }
      : cardDesign.designType === 'solid' && cardDesign.solidColor
      ? {
          background: cardDesign.solidColor,
        }
      : {
          background: `linear-gradient(135deg, ${cardDesign.gradientColors?.primary || '#f66633'} 0%, ${cardDesign.gradientColors?.secondary || '#ff8c64'} 100%)`,
        };

  // Back card style (use backCardImageUrl or backCardColor, fallback to gradient - NO front image)
  const backCardStyle = backImageUrl
    ? {
        backgroundImage: `url(${backImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : cardDesign.backCardColor
    ? {
        background: cardDesign.backCardColor,
      }
    : {
        background: `linear-gradient(135deg, ${cardDesign.gradientColors?.primary || '#f66633'} 0%, ${cardDesign.gradientColors?.secondary || '#ff8c64'} 100%)`,
      };

  const textColor = cardDesign.textColor || '#FFFFFF';
  const cardName = cardDesign.name || 'ESPRO Collective Card';
  const cardDescription = cardDesign.description || 'Your loyalty card for ESPRO Collective';

  return (
    <div className="mb-6 w-full flex justify-center">
      <div
        className="relative rounded-2xl shadow-xl cursor-pointer responsive-card-height"
        style={{
          width: '100%',
          maxWidth: '428px',
          color: textColor,
        }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className="card-flip-container absolute inset-0">
          <div className={`card-flip-inner ${isFlipped ? 'flipped' : ''} absolute inset-0`}>
            {/* Front of Card */}
            <div className="card-flip-front">
              <div
                className="w-full h-full rounded-2xl p-6 relative flex flex-col"
                style={{
                  ...cardStyle,
                  color: textColor,
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-xs opacity-90 tracking-wider uppercase mb-1" style={{ color: textColor }}>ESPRO</div>
                    <div className="text-sm opacity-80" style={{ color: textColor }}>Collective Card</div>
                  </div>
                </div>
                
                <div className="flex-1 min-h-0"></div>
                
                <div className="mt-auto pt-4 flex-shrink-0" style={{ borderTop: cardDesign.designType === 'image' || cardDesign.designType === 'reward' ? 'none' : `1px solid ${textColor}33` }}>
                  <div className="text-sm opacity-90 mb-2" style={{ color: textColor }}>Balance</div>
                  <div className="text-5xl font-bold tracking-tight" style={{ color: textColor }}>{formatEsproCoinsDisplay(user?.esproCoins || 0)}</div>
                  <div className="text-xs opacity-80 mt-1" style={{ color: textColor }}>espro coins</div>
                </div>
                
                <div className="absolute bottom-4 right-4 text-xs opacity-60" style={{ color: textColor }}>Tap to flip</div>
              </div>
            </div>

            {/* Back of Card */}
            <div className="card-flip-back">
              <div
                className="w-full h-full rounded-2xl p-6 flex flex-col justify-between"
                style={{
                  ...backCardStyle,
                  color: textColor,
                }}
              >
                <div>
                  <div className="text-xs opacity-90 tracking-wider uppercase mb-2" style={{ color: textColor }}>ESPRO</div>
                  <div className="text-lg font-semibold mb-4" style={{ color: textColor }}>{cardName}</div>
                  <div className="text-sm opacity-90 leading-relaxed" style={{ color: textColor }}>
                    {cardDescription}
                  </div>
                </div>
                <div className="mt-auto">
                  <div className="text-center mb-2">
                    <div className="text-xs opacity-90 mb-1" style={{ color: textColor }}>Loyalty ID</div>
                    <div className="text-sm font-mono tracking-wider opacity-100 font-semibold" style={{ color: textColor }}>{user?.loyaltyId || 'N/A'}</div>
                  </div>
                  <div className="text-xs opacity-60 text-center" style={{ color: textColor }}>Tap to flip back</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

