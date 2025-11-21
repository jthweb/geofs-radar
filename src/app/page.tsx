// app/atc/page.tsx
'use client';

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import dynamic from 'next/dynamic';
import { type PositionUpdate } from '~/lib/aircraft-store';
import { useViewerTracker } from  '~/hooks/use-viewer-counter';

import { DesktopSidebar } from '~/components/desktop-sidebar';
import MobileSidebar, { type MobileSidebarHandle } from '~/components/mobile-sidebar';

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
}

type AirportMap = Record<string, Airport>;

const DynamicMapComponent = dynamic(() => import('~/components/map'), {
  ssr: false,
  loading: () => (
    <div style={{ textAlign: 'center', paddingTop: '50px' }}>
      Loading Map...
    </div>
  ),
});

export default function ATCPage() {
  const [aircrafts, setAircrafts] = useState<PositionUpdate[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [selectedAircraft, setSelectedAircraft] =
    useState<PositionUpdate | null>(null);
  const [selectedWaypointIndex, setSelectedWaypointIndex] =
    useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('connecting');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<
    (PositionUpdate | Airport)[]
  >([]);
  const [isMobile, setIsMobile] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const drawFlightPlanOnMapRef = useRef<
    ((aircraft: PositionUpdate, shouldZoom?: boolean) => void) | null
  >(null);

  const mobileSidebarRef = useRef<MobileSidebarHandle>(null);

  useViewerTracker({ enabled: true });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleMediaQueryChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
      if (!event.matches && selectedAircraft && mobileSidebarRef.current) {
         mobileSidebarRef.current.snapTo('closed');
      }
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleMediaQueryChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaQueryChange);
    };
  }, [selectedAircraft]);

  const handleAircraftSelect = useCallback((aircraft: PositionUpdate | null) => {
    setSelectedAircraft(aircraft);
    setSelectedWaypointIndex(null);
    if (isMobile && aircraft && mobileSidebarRef.current) {
        mobileSidebarRef.current.snapTo('half');
    }
  }, [isMobile]);

  const handleWaypointClick = useCallback((waypoint: any, index: number) => {
    setSelectedWaypointIndex(index);
    if (isMobile && mobileSidebarRef.current) {
        mobileSidebarRef.current.snapTo('full');
    }
  }, [isMobile]);

  const handleMobileSidebarClose = useCallback(() => {
    setSelectedAircraft(null);
    setSelectedWaypointIndex(null);
    if (mobileSidebarRef.current) {
      mobileSidebarRef.current.snapTo('closed');
    }
  }, []);

  const fetchAirports = useCallback(async () => {
    try {
      const response = await fetch('/airports.json');
      const airportMap: AirportMap = await response.json();
      const airportArray: Airport[] = Object.values(airportMap);
      setAirports(airportArray);
    } catch (e) {
      console.warn('Could not load airports.json');
    }
  }, []);

  const connectToStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log('Connecting to SSE stream...');
    setConnectionStatus('connecting');

    const eventSource = new EventSource('/api/atc/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✓ SSE connection established');
      setConnectionStatus('connected');
      setError(null);
      reconnectAttempts.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        const processedAircraft: PositionUpdate[] =
          data.aircraft?.map((ac: any) => ({
            ...ac,
            ts: ac.ts || Date.now(),
          })) || [];

        setAircrafts(processedAircraft);
        setIsLoading(false);
        setError(null);
      } catch (e) {
        console.error('Error parsing SSE data:', e);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      setConnectionStatus('disconnected');
      eventSource.close();

      const backoffTime = Math.min(
        1000 * Math.pow(2, reconnectAttempts.current),
        30000
      );
      reconnectAttempts.current++;

      setError(`Connection lost. Reconnecting in ${backoffTime / 1000}s...`);

      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`Reconnect attempt #${reconnectAttempts.current}`);
        connectToStream();
      }, backoffTime);
    };
  }, []);

  useEffect(() => {
    fetchAirports();
    connectToStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchAirports, connectToStream]);

  useEffect(() => {
    if (selectedAircraft && aircrafts.length > 0) {
      const updatedAircraft = aircrafts.find(
        (ac) =>
          ac.callsign === selectedAircraft.callsign ||
          ac.flightNo === selectedAircraft.flightNo
      );

      if (updatedAircraft) {
        setSelectedAircraft(updatedAircraft);
      } else {
        setSelectedAircraft(null);
        if (isMobile && mobileSidebarRef.current) {
            mobileSidebarRef.current.snapTo('closed');
        }
      }
    }
  }, [aircrafts, selectedAircraft, isMobile]);

  const performSearch = useCallback(() => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const results: (PositionUpdate | Airport)[] = [];

    aircrafts.forEach((ac) => {
      if (
        ac.callsign?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.flightNo?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.departure?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.arrival?.toLowerCase().includes(lowerCaseSearchTerm)
      ) {
        results.push(ac);
      }
    });

    airports.forEach((airport) => {
      if (
        airport.icao.toLowerCase().includes(lowerCaseSearchTerm) ||
        airport.name.toLowerCase().includes(lowerCaseSearchTerm)
      ) {
        results.push(airport);
      }
    });

    setSearchResults(results);
  }, [searchTerm, aircrafts, airports]);

  useEffect(() => {
    const handler = setTimeout(() => {
      performSearch();
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, performSearch]);

  const setDrawFlightPlanOnMap = useCallback(
    (func: (aircraft: PositionUpdate, shouldZoom?: boolean) => void) => {
      drawFlightPlanOnMapRef.current = func;
    },
    []
  );

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: isMobile ? '50%' : 50,
          transform: isMobile ? 'translateX(-50%)' : 'none',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          width: isMobile ? 'calc(100% - 40px)' : 'auto',
          maxWidth: isMobile ? '400px' : '280px',
        }}
      >
        <input
          type="text"
          placeholder="Search callsign, flight, or ICAO..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            color: 'white',
            fontSize: '14px',
            outline: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            width: '100%',
            marginBottom: searchTerm && searchResults.length > 0 ? '10px' : '0',
          }}
        />

        {searchTerm && searchResults.length > 0 && (
          <div
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              width: '100%',
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {searchResults.map((result, index) => (
              <div
                key={
                  'callsign' in result
                    ? result.callsign || result.flightNo || index
                    : result.icao
                }
                style={{
                  padding: '10px 14px',
                  borderBottom:
                    index < searchResults.length - 1
                      ? '1px solid rgba(255, 255, 255, 0.08)'
                      : 'none',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: '14px',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    'rgba(59, 130, 246, 0.15)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = 'transparent')
                }
                onClick={() => {
                  if ('callsign' in result) {
                    setSelectedAircraft(result);
                    drawFlightPlanOnMapRef.current?.(result, true);
                    setSearchTerm('');
                    setSearchResults([]);
                    if (isMobile && mobileSidebarRef.current) {
                        mobileSidebarRef.current.snapTo('half');
                    }
                  } else {
                    console.log('Selected airport:', result);
                    setSearchTerm('');
                    setSearchResults([]);
                  }
                }}
              >
                {'callsign' in result ? (
                  <>
                    <div style={{ fontWeight: 'bold' }}>
                      {result.callsign || result.flightNo || 'N/A'}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.6)',
                      }}
                    >
                      {result.type} ({result.departure} to{' '}
                      {result.arrival || 'UNK'})
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 'bold' }}>{result.icao}</div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.6)',
                      }}
                    >
                      {result.name} (Airport)
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 10000,
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '600',
          backgroundColor:
            connectionStatus === 'connected'
              ? 'rgba(16, 185, 129, 0.9)'
              : connectionStatus === 'connecting'
                ? 'rgba(251, 191, 36, 0.9)'
                : 'rgba(239, 68, 68, 0.9)',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {connectionStatus === 'connected' && '● Live'}
        {connectionStatus === 'connecting' && '◐ Connecting...'}
        {connectionStatus === 'disconnected' && '○ Disconnected'}
      </div>

      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
        {isLoading && aircrafts.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              paddingTop: '50px',
              background: '#333',
              color: '#fff',
            }}
          >
            Loading initial data...
          </div>
        ) : (
          <DynamicMapComponent
            aircrafts={aircrafts}
            airports={airports}
            onAircraftSelect={handleAircraftSelect}
            selectedWaypointIndex={selectedWaypointIndex}
            selectedAirport={
              searchResults.find(
                (r) =>
                  !('callsign' in r) &&
                  searchTerm &&
                  r.icao.toLowerCase() === searchTerm.toLowerCase()
              ) as Airport | undefined
            }
            setDrawFlightPlanOnMap={setDrawFlightPlanOnMap}
          />
        )}
      </div>

      {!isMobile && selectedAircraft && (
        <div
          style={{
            transform: selectedAircraft ? 'translateX(0)' : 'translateX(380px)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'absolute',
            top: 0,
            right: 0,
            zIndex: 99997,
            width: '380px',
            height: '100%',
          }}
        >
          <DesktopSidebar
            aircraft={selectedAircraft}
            onWaypointClick={handleWaypointClick}
          />
        </div>
      )}

      {isMobile && selectedAircraft && (
        <MobileSidebar
            ref={mobileSidebarRef}
            aircraft={selectedAircraft}
            onWaypointClick={handleWaypointClick}
            onClose={handleMobileSidebarClose}
        />
      )}
    </div>
  );
}