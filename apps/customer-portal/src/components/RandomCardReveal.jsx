import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBaseApiUrl } from '../utils/api';

export default function RandomCardReveal({ 
  isOpen, 
  onClose, 
  cardDesigns, 
  revealedCardDesign,
  reward, // Add reward prop to display reward name
  onRevealComplete 
}) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const intervalsRef = useRef([]);
  const timeoutsRef = useRef([]);
  const hasStartedRef = useRef(false);
  const revealedIndexRef = useRef(-1); // Store the revealed card index

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[RandomCardReveal] useEffect triggered:', {
        isOpen,
        cardDesignsLength: cardDesigns?.length,
        revealedCardDesign: revealedCardDesign ? { _id: revealedCardDesign._id, name: revealedCardDesign.name } : null,
        hasStarted: hasStartedRef.current
      });
    }
    
    // Reset when modal closes
    if (!isOpen) {
      if (import.meta.env.DEV) {
        console.log('[RandomCardReveal] Modal closed, resetting state');
      }
      hasStartedRef.current = false;
      revealedIndexRef.current = -1; // Reset revealed index
      setIsSpinning(false);
      setRevealed(false);
      setCurrentIndex(0);
      // Clear all intervals and timeouts
      intervalsRef.current.forEach(interval => clearInterval(interval));
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      intervalsRef.current = [];
      timeoutsRef.current = [];
      return;
    }

    // Only start animation once when modal opens
    // Use effectiveCardDesigns (cardDesigns or revealedCardDesign as fallback)
    // IMPORTANT: Always ensure revealedCardDesign is in the array for proper display
    let effectiveCardDesigns = cardDesigns && cardDesigns.length > 0 
      ? [...cardDesigns] 
      : [];
    
    // If we have a revealedCardDesign, ensure it's in the array (replace if it exists, add if it doesn't)
    if (revealedCardDesign && revealedCardDesign._id) {
      const revealedId = revealedCardDesign._id.toString();
      const existingIndex = effectiveCardDesigns.findIndex(c => c && c._id && c._id.toString() === revealedId);
      
      if (existingIndex !== -1) {
        // Replace the existing entry with the full revealedCardDesign (has all fields)
        effectiveCardDesigns[existingIndex] = revealedCardDesign;
        revealedIndexRef.current = existingIndex; // Store the revealed index
      } else {
        // Add the revealedCardDesign to the array
        effectiveCardDesigns.push(revealedCardDesign);
        revealedIndexRef.current = effectiveCardDesigns.length - 1; // Store the revealed index
      }
    } else if (revealedCardDesign && !effectiveCardDesigns.length) {
      // If no cardDesigns but we have revealedCardDesign, use it
      effectiveCardDesigns = [revealedCardDesign];
      revealedIndexRef.current = 0; // Store the revealed index
    } else {
      // Find the revealed index if it's already in the array
      if (revealedCardDesign && revealedCardDesign._id) {
        const revealedId = revealedCardDesign._id.toString();
        const foundIndex = effectiveCardDesigns.findIndex(c => c && c._id && c._id.toString() === revealedId);
        revealedIndexRef.current = foundIndex !== -1 ? foundIndex : -1;
      }
    }
    
    if (import.meta.env.DEV) {
      console.log('[RandomCardReveal] Effective card designs:', {
      effectiveCardDesignsLength: effectiveCardDesigns.length,
      effectiveCardDesigns: effectiveCardDesigns.map((c, idx) => ({ 
        index: idx,
        id: c._id?.toString(), 
        name: c.name, 
        imageUrl: c.imageUrl 
      })),
      revealedCardDesign: revealedCardDesign ? { 
        id: revealedCardDesign._id?.toString(), 
        name: revealedCardDesign.name, 
        imageUrl: revealedCardDesign.imageUrl 
      } : null,
      revealedIndex: revealedIndexRef.current,
      revealedCardMatches: revealedCardDesign && revealedCardDesign._id ? 
        effectiveCardDesigns.findIndex(c => c && c._id && c._id.toString() === revealedCardDesign._id.toString()) : -1
      });
    }
    
    if (isOpen && effectiveCardDesigns.length > 0 && !hasStartedRef.current) {
      if (import.meta.env.DEV) {
        console.log('[RandomCardReveal] Starting animation');
      }
      hasStartedRef.current = true;
      setIsSpinning(true);
      setRevealed(false);
      
      // If we only have one card (the revealed one), skip animation and show it immediately
      if (effectiveCardDesigns.length === 1 && revealedCardDesign) {
        if (import.meta.env.DEV) {
          console.log('[RandomCardReveal] Only one card, skipping animation');
        }
        setCurrentIndex(0);
        setIsSpinning(false);
        setRevealed(true);
        
        // Call onRevealComplete after a short delay
        const timeout = setTimeout(() => {
          if (import.meta.env.DEV) {
            console.log('[RandomCardReveal] Single card reveal complete');
          }
          if (onRevealComplete) {
            onRevealComplete();
          }
        }, 500);
        timeoutsRef.current.push(timeout);
        return;
      }

      // Validate that we have a valid revealed index
      if (revealedIndexRef.current === -1) {
        if (import.meta.env.DEV) {
          console.error('[RandomCardReveal] CRITICAL: No valid revealed index found!', {
            revealedCardDesign,
            effectiveCardDesigns: effectiveCardDesigns.map(c => ({ id: c._id?.toString(), name: c.name }))
          });
        }
        // Try to find it one more time
        if (revealedCardDesign && revealedCardDesign._id) {
          const revealedId = revealedCardDesign._id.toString();
          const foundIndex = effectiveCardDesigns.findIndex(c => c && c._id && c._id.toString() === revealedId);
          if (foundIndex !== -1) {
            revealedIndexRef.current = foundIndex;
            if (import.meta.env.DEV) {
              console.log('[RandomCardReveal] Found revealed index on retry:', foundIndex);
            }
          }
        }
      }

      // Start with random index for better visual effect (but not the revealed one)
      let startIndex = Math.floor(Math.random() * effectiveCardDesigns.length);
      // Make sure we don't start on the revealed card
      if (startIndex === revealedIndexRef.current && effectiveCardDesigns.length > 1) {
        startIndex = (startIndex + 1) % effectiveCardDesigns.length;
      }
      if (import.meta.env.DEV) {
        console.log('[RandomCardReveal] Starting animation at index:', startIndex, 'Revealed index:', revealedIndexRef.current);
      }
      setCurrentIndex(startIndex);

      // Spin through cards quickly
      const spinInterval = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = (prev + 1) % effectiveCardDesigns.length;
          return next;
        });
      }, 100); // Change card every 100ms
      
      intervalsRef.current.push(spinInterval);
      if (import.meta.env.DEV) {
        console.log('[RandomCardReveal] Fast spin interval started');
      }

      // After 2 seconds, slow down
      const timeout1 = setTimeout(() => {
        if (import.meta.env.DEV) {
          console.log('[RandomCardReveal] Slowing down animation');
        }
        // Find and clear the spin interval
        const spinIntervalToClear = intervalsRef.current.find(id => id === spinInterval);
        if (spinIntervalToClear) {
          clearInterval(spinIntervalToClear);
          intervalsRef.current = intervalsRef.current.filter(id => id !== spinIntervalToClear);
        }
        
        // Slow spin
        const slowSpinInterval = setInterval(() => {
          setCurrentIndex((prev) => (prev + 1) % effectiveCardDesigns.length);
        }, 200);
        
        intervalsRef.current.push(slowSpinInterval);

        // After another 1 second, reveal the actual card
        const timeout2 = setTimeout(() => {
          if (import.meta.env.DEV) {
            console.log('[RandomCardReveal] Revealing final card');
          }
          // Find and clear the slow spin interval
          const slowSpinIntervalToClear = intervalsRef.current.find(id => id === slowSpinInterval);
          if (slowSpinIntervalToClear) {
            clearInterval(slowSpinIntervalToClear);
            intervalsRef.current = intervalsRef.current.filter(id => id !== slowSpinIntervalToClear);
          }
          
          // Use the stored revealed index - this is the correct card to show
          const finalRevealedIndex = revealedIndexRef.current;
          if (import.meta.env.DEV) {
            console.log('[RandomCardReveal] Revealed card index (from ref):', {
              finalRevealedIndex,
              revealedCardDesign: revealedCardDesign ? { id: revealedCardDesign._id?.toString(), name: revealedCardDesign.name } : null,
              effectiveCardDesignsLength: effectiveCardDesigns.length,
              cardAtRevealedIndex: finalRevealedIndex !== -1 ? effectiveCardDesigns[finalRevealedIndex] : null
            });
          }
          
          if (finalRevealedIndex !== -1 && finalRevealedIndex < effectiveCardDesigns.length) {
            setCurrentIndex(finalRevealedIndex);
            if (import.meta.env.DEV) {
              console.log('[RandomCardReveal] Setting current index to revealed card:', {
                index: finalRevealedIndex,
                cardName: effectiveCardDesigns[finalRevealedIndex]?.name,
                revealedCardName: revealedCardDesign?.name
              });
            }
          } else {
            // Fallback: try to find it again
            if (import.meta.env.DEV) {
              console.error('[RandomCardReveal] Invalid revealed index, trying to find card again');
            }
            if (revealedCardDesign && revealedCardDesign._id) {
              const revealedId = revealedCardDesign._id.toString();
              const foundIndex = effectiveCardDesigns.findIndex(
                (c) => {
                  if (!c || !c._id) return false;
                  const cardId = c._id.toString();
                  return cardId === revealedId;
                }
              );
              if (foundIndex !== -1) {
                setCurrentIndex(foundIndex);
                revealedIndexRef.current = foundIndex;
                if (import.meta.env.DEV) {
                  console.log('[RandomCardReveal] Found and set revealed index:', foundIndex);
                }
              } else {
                if (import.meta.env.DEV) {
                  console.error('[RandomCardReveal] CRITICAL: Revealed card not found!');
                }
                setCurrentIndex(0);
              }
            } else {
              setCurrentIndex(0);
            }
          }
          
          setIsSpinning(false);
          setRevealed(true);
          if (import.meta.env.DEV) {
            console.log('[RandomCardReveal] Animation complete, card revealed at index:', finalRevealedIndex);
          }
          
          // Call onRevealComplete after animation
          const timeout3 = setTimeout(() => {
            if (import.meta.env.DEV) {
              console.log('[RandomCardReveal] Calling onRevealComplete');
            }
            if (onRevealComplete) {
              onRevealComplete();
            }
          }, 1000);
          
          timeoutsRef.current.push(timeout3);
        }, 1000);
        
        timeoutsRef.current.push(timeout2);
      }, 2000);
      
      timeoutsRef.current.push(timeout1);
    } else {
      if (import.meta.env.DEV) {
        console.log('[RandomCardReveal] Not starting animation:', {
          isOpen,
          effectiveCardDesignsLength: effectiveCardDesigns.length,
          hasStarted: hasStartedRef.current
        });
      }
    }

    // Cleanup function - only clear if modal is closing
    return () => {
      // Only cleanup if isOpen is false (modal is closing)
      if (!isOpen) {
        intervalsRef.current.forEach(interval => clearInterval(interval));
        timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        intervalsRef.current = [];
        timeoutsRef.current = [];
      }
    };
  }, [isOpen, cardDesigns, revealedCardDesign]); // Removed onRevealComplete from dependencies

  // Use effectiveCardDesigns for rendering (cardDesigns or revealedCardDesign as fallback)
  // IMPORTANT: Always ensure revealedCardDesign is in the array for proper display
  let effectiveCardDesigns = cardDesigns && cardDesigns.length > 0 
    ? [...cardDesigns] 
    : [];
  
  // If we have a revealedCardDesign, ensure it's in the array (replace if it exists, add if it doesn't)
  if (revealedCardDesign && revealedCardDesign._id) {
    const revealedId = revealedCardDesign._id.toString();
    const existingIndex = effectiveCardDesigns.findIndex(c => c && c._id && c._id.toString() === revealedId);
    
    if (existingIndex !== -1) {
      // Replace the existing entry with the full revealedCardDesign (has all fields)
      effectiveCardDesigns[existingIndex] = revealedCardDesign;
    } else {
      // Add the revealedCardDesign to the array
      effectiveCardDesigns.push(revealedCardDesign);
    }
  } else if (revealedCardDesign && !effectiveCardDesigns.length) {
    // If no cardDesigns but we have revealedCardDesign, use it
    effectiveCardDesigns = [revealedCardDesign];
  }

  if (import.meta.env.DEV) {
    console.log('[RandomCardReveal] Render:', {
      isOpen,
      effectiveCardDesignsLength: effectiveCardDesigns.length,
      currentIndex,
      isSpinning,
      revealed,
      hasStarted: hasStartedRef.current,
      revealedCardDesignId: revealedCardDesign?._id,
      currentCardId: effectiveCardDesigns[currentIndex]?._id
    });
  }

  if (!isOpen) return null;

  if (effectiveCardDesigns.length === 0) {
    if (import.meta.env.DEV) {
      console.log('[RandomCardReveal] No card designs available, showing loading');
    }
    // Show loading state if we don't have card designs yet
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div 
          className="bg-white rounded-2xl p-6 max-w-md w-full relative" 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-espro-orange mx-auto mb-4"></div>
            <p className="text-gray-600">Loading card design...</p>
          </div>
        </div>
      </div>
    );
  }

  // Get the current card being displayed
  const currentCard = effectiveCardDesigns[currentIndex] || effectiveCardDesigns[0];
  
  // Debug: Log which card is being displayed
  if (revealed && revealedCardDesign && import.meta.env.DEV) {
    const isShowingRevealedCard = currentCard && currentCard._id && revealedCardDesign._id && 
      currentCard._id.toString() === revealedCardDesign._id.toString();
    console.log('[RandomCardReveal] Render - Current card:', {
      currentIndex,
      currentCardName: currentCard?.name,
      currentCardId: currentCard?._id?.toString(),
      revealedCardName: revealedCardDesign?.name,
      revealedCardId: revealedCardDesign?._id?.toString(),
      isShowingRevealedCard,
      revealedIndex: revealedIndexRef.current
    });
  }
  
  if (!currentCard) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div 
          className="bg-white rounded-2xl p-6 max-w-md w-full relative" 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <p className="text-gray-600 mb-4">Unable to load card design</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-espro-orange text-white rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Construct full image URL - use mobile image on small screens if available
  const isMobileScreen = window.innerWidth <= 768;
  const baseImageUrl = isMobileScreen && currentCard.mobileImageUrl 
    ? currentCard.mobileImageUrl 
    : currentCard.imageUrl;
  
  const imageUrl = baseImageUrl 
    ? (baseImageUrl.startsWith('http://') || baseImageUrl.startsWith('https://')
        ? baseImageUrl 
        : `${getBaseApiUrl()}${baseImageUrl}`)
    : null;

  const cardStyle =
    (currentCard.designType === 'image' || currentCard.designType === 'reward') && imageUrl
      ? {
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }
      : currentCard.designType === 'solid' && currentCard.solidColor
      ? {
          background: currentCard.solidColor,
        }
      : {
          background: `linear-gradient(135deg, ${currentCard.gradientColors?.primary || '#f66633'} 0%, ${currentCard.gradientColors?.secondary || '#ff8c64'} 100%)`,
        };

  const textColor = currentCard.textColor || '#FFFFFF';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl p-6 max-w-md w-full relative" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {revealed ? 'You Got!' : 'Selecting your card'}
          </h2>
          {!revealed && (
            <p className="text-sm text-gray-600">Please wait...</p>
          )}
        </div>

        <div className="relative mb-6">
          <div
            className={`w-full rounded-xl overflow-hidden shadow-2xl transition-all duration-300 ${
              isSpinning ? 'animate-pulse' : ''
            } ${revealed ? 'ring-4 ring-espro-orange' : ''}`}
            style={{
              aspectRatio: '428 / 300',
              ...cardStyle,
              color: textColor,
            }}
          >
            <div className="h-full p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs opacity-90 tracking-wider uppercase mb-1" style={{ color: textColor }}>
                  ESPRO
                </div>
                <div className="text-sm opacity-80" style={{ color: textColor }}>
                  Collective Card
                </div>
              </div>
              <div className="mt-auto">
                <div className="text-3xl font-bold" style={{ color: textColor }}>
                  {currentCard.name || 'Card Design'}
                </div>
                {currentCard.description && (
                  <div className="text-xs opacity-90 mt-2" style={{ color: textColor }}>
                    {currentCard.description}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {isSpinning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>

        {revealed && (
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 mb-1">{currentCard.name}</div>
            {currentCard.description && (
              <div className="text-sm text-gray-600 mb-2">{currentCard.description}</div>
            )}
            {reward && reward.title && (
              <div className="text-xs text-gray-500 mb-4">
                Reward: {reward.title}
              </div>
            )}
            <button
              onClick={() => {
                onClose();
                navigate('/collections');
              }}
              className="w-full bg-espro-orange text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
            >
              View Card Design
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

