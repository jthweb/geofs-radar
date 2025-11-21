// components/mobile-sidebar.tsx
import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from 'react';
import { type PositionUpdate } from '~/lib/aircraft-store';
import { DesktopSidebar } from './desktop-sidebar';

interface MobileSidebarProps {
  aircraft: PositionUpdate & { altMSL?: number };
  onWaypointClick?: (waypoint: any, index: number) => void;
  onClose: () => void;
}

export interface MobileSidebarHandle {
  snapTo: (position: 'closed' | 'half' | 'full') => void;
}

const MobileSidebar = forwardRef<MobileSidebarHandle, MobileSidebarProps>(
  ({ aircraft, onWaypointClick, onClose }, ref) => {
    const [currentHeight, setCurrentHeight] = useState(70);
    const sheetRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const startHeight = useRef(70);
    const isDragging = useRef(false);

    const fullHeight = window.innerHeight * 0.9;
    const halfHeight = window.innerHeight * 0.6;
    const closedHeight = 70;

    const snapTo = useCallback(
      (position: 'closed' | 'half' | 'full') => {
        if (sheetRef.current) {
          if (position === 'full') {
            setCurrentHeight(fullHeight);
          } else if (position === 'half') {
            setCurrentHeight(halfHeight);
          } else {
            setCurrentHeight(closedHeight);
          }
        }
      },
      [fullHeight, halfHeight, closedHeight]
    );

    useImperativeHandle(ref, () => ({ snapTo }));

    const handleTouchStart = useCallback((e: any) => {
      startY.current = e.touches[0].clientY;
      startHeight.current = currentHeight;
      isDragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }, [currentHeight]);

    const handleTouchMove = useCallback((e: any) => {
      if (!isDragging.current) return;

      const deltaY = startY.current - e.touches[0].clientY;
      let newHeight = startHeight.current + deltaY;

      newHeight = Math.max(closedHeight, Math.min(newHeight, fullHeight));
      setCurrentHeight(newHeight);
    }, [fullHeight, closedHeight]);

    const handleTouchEnd = useCallback(() => {
      isDragging.current = false;

      if (currentHeight > halfHeight * 0.8) {
        if (currentHeight > fullHeight * 0.85) {
          snapTo('full');
        } else {
          snapTo('half');
        }
      } else if (currentHeight < halfHeight * 0.5) {
        snapTo('closed');
      } else {
        snapTo('half');
      }

      if (currentHeight < closedHeight + 20 && startHeight.current === closedHeight) {
        snapTo('half');
      }

    }, [currentHeight, fullHeight, halfHeight, snapTo, closedHeight]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      startY.current = e.clientY;
      startHeight.current = currentHeight;
      isDragging.current = true;
      document.body.style.userSelect = 'none';
    }, [currentHeight]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
      if (!isDragging.current) return;
      const deltaY = startY.current - e.clientY;
      let newHeight = startHeight.current + deltaY;
      newHeight = Math.max(closedHeight, Math.min(newHeight, fullHeight));
      setCurrentHeight(newHeight);
    }, [fullHeight, closedHeight]);

    const handleMouseUp = useCallback(() => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.userSelect = '';
        if (currentHeight > halfHeight * 0.8) {
          if (currentHeight > fullHeight * 0.85) {
            snapTo('full');
          } else {
            snapTo('half');
          }
        } else if (currentHeight < halfHeight * 0.5) {
          snapTo('closed');
        } else {
          snapTo('half');
        }

        if (currentHeight < closedHeight + 20 && startHeight.current === closedHeight) {
          snapTo('half');
        }
      }
    }, [currentHeight, fullHeight, halfHeight, snapTo, closedHeight]);

    useEffect(() => {
      const handleGlobalMouseUp = () => {
        if (isDragging.current) {
          handleMouseUp();
        }
      };
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }, [handleMouseUp]);


    const renderCloseButton = useMemo(() => {
        if (currentHeight > halfHeight * 0.9) {
            return (
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 10,
                        color: 'white',
                        fontSize: '20px',
                    }}
                >
                    &times;
                </button>
            );
        }
        return null;
    }, [currentHeight, halfHeight, onClose]);


    return (
      <div
        ref={sheetRef}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          height: `${currentHeight}px`,
          backgroundColor: 'rgba(17, 24, 39, 0.98)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
          color: '#fff',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          transition: isDragging.current ? 'none' : 'height 0.3s ease-out',
        }}
      >
        <div
          style={{
            height: '30px',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'grab',
            paddingTop: '8px',
            touchAction: 'none',
          }}
          onTouchStart={(e) => handleTouchStart(e)}
          onTouchMove={(e) => handleTouchMove(e)}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div
            style={{
              width: '40px',
              height: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '2px',
            }}
          />
        </div>
        {renderCloseButton}
        <div
            style={{
                flexGrow: 1,
                overflowY: currentHeight > closedHeight + 50 ? 'auto' : 'hidden',
                paddingBottom: currentHeight > closedHeight + 50 ? '20px' : '0',
            }}
            onTouchStart={(e) => {
                if (currentHeight > closedHeight + 50) {
                    e.stopPropagation();
                }
            }}
            onMouseDown={(e) => {
                if (currentHeight > closedHeight + 50) {
                    e.stopPropagation();
                }
            }}
        >
          <DesktopSidebar aircraft={aircraft} onWaypointClick={onWaypointClick} />
        </div>
      </div>
    );
  }
);

MobileSidebar.displayName = 'MobileSidebar';
export default MobileSidebar;