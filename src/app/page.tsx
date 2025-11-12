'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { type PositionUpdate } from '~/lib/aircraft-store';

interface Airport {
    name: string;
    lat: number;
    lon: number;
    icao: string;
}

const DynamicMapComponent = dynamic(
  () => import('~/components/map'),
  { 
    ssr: false,
    loading: () => <div style={{ textAlign: 'center', paddingTop: '50px' }}>Loading Map...</div>
  }
);

export default function ATCPage() {
  const [aircrafts, setAircrafts] = useState<PositionUpdate[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]); // New state for dynamic airport data
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch Aircraft Data
    const fetchAircraft = async () => {
      try {
        const response = await fetch('/api/atc/position');
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        
        const processedAircraft: PositionUpdate[] = data.aircraft.map((ac: any) => ({
          ...ac,
          ts: ac.ts || Date.now(),
        }));
        
        setAircrafts(processedAircraft || []);
        setError(null);
      } catch (e) {
        console.error(e);
        setError('Failed to load aircraft data. Check the API status.');
      } finally {
        setIsLoading(false);
      }
    };
    
    // 2. Fetch Airport Data from public/airports.json
    const fetchAirports = async () => {
        try {
            const response = await fetch('/airports.json');
            const data: Airport[] = await response.json();
            setAirports(data);
        } catch (e) {
            console.warn("Could not load airports.json. Ensure file exists in /public directory.");
        }
    };

    fetchAircraft();
    fetchAirports();
    const intervalId = setInterval(fetchAircraft, 5000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
        {isLoading && aircrafts.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '50px', background: '#333', color: '#fff' }}>Loading initial data...</div>
        ) : (
          // Pass the dynamically fetched airport data
          <DynamicMapComponent aircrafts={aircrafts} airports={airports} />
        )}
      </div>
    </div>
  );
}