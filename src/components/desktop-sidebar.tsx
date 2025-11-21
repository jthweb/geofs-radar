// components/desktop-sidebar.tsx
import React, { useCallback, useMemo } from 'react';
import { type PositionUpdate } from '~/lib/aircraft-store';

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
}

type AirportMap = Record<string, Airport>;

export const DesktopSidebar = React.memo(
  ({
    aircraft,
    onWaypointClick,
  }: {
    aircraft: PositionUpdate & { altMSL?: number };
    onWaypointClick?: (waypoint: any, index: number) => void;
  }) => {
    const altMSL = aircraft.altMSL ?? aircraft.alt;
    const altAGL = aircraft.alt;
    const isOnGround = altAGL < 100;

    const renderFlightPlan = useCallback(() => {
      if (!aircraft.flightPlan)
        return (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '14px',
            }}
          >
            No flight plan available
          </div>
        );

      try {
        const waypoints = JSON.parse(aircraft.flightPlan);
        return (
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              padding: '0 16px 16px 16px',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'rgba(255,255,255,0.9)',
                marginBottom: '12px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              Flight Plan
            </div>
            {waypoints.map((wp: any, index: number) => (
              <div
                key={index}
                style={{
                  padding: '12px 14px',
                  marginBottom: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
                onClick={() => onWaypointClick?.(wp, index)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.borderColor =
                    'rgba(59, 130, 246, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor =
                    'rgba(255, 255, 255, 0.08)';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                  }}
                >
                  <span
                    style={{
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#fff',
                    }}
                  >
                    {wp.ident}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.5)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {wp.type}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.7)',
                    display: 'flex',
                    gap: '12px',
                  }}
                >
                  <span>
                    Alt:{' '}
                    <strong>{wp.alt ? wp.alt + ' ft' : 'N/A'}</strong>
                  </span>
                  <span>
                    Spd:{' '}
                    <strong>{wp.spd ? wp.spd + ' kt' : 'N/A'}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      } catch (e) {
        return (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: 'rgba(239, 68, 68, 0.8)',
              fontSize: '14px',
            }}
          >
            Error loading flight plan
          </div>
        );
      }
    }, [aircraft.flightPlan, onWaypointClick]);

    const displayAltMSL =
      altMSL >= 18000
        ? `FL${Math.round(altMSL / 100)}`
        : `${altMSL.toFixed(0)} ft`;

    return (
      <div
        style={{
          backgroundColor: 'rgba(17, 24, 39, 0.98)',
          backdropFilter: 'blur(12px)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
        }}
      >
        <div
          style={{
            background:
              'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
            padding: '20px 20px 16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div
            style={{
              fontSize: '24px',
              fontWeight: '700',
              marginBottom: '4px',
              letterSpacing: '-0.5px',
            }}
          >
            {aircraft.callsign || aircraft.flightNo || 'N/A'}
          </div>
          <div
            style={{
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.6)',
              fontWeight: '500',
              letterSpacing: '0.5px',
            }}
          >
            {aircraft.type || 'Unknown Type'}
          </div>
        </div>

        <div
          style={{
            padding: '16px 16px 0 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              padding: '14px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '10px',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.6)',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '600',
              }}
            >
              Flight Number
            </div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>
              {aircraft.flightNo || 'N/A'}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            <div
              style={{
                padding: '14px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '600',
                }}
              >
                From
              </div>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>
                {aircraft.departure || 'UNK'}
              </div>
            </div>
            <div
              style={{
                padding: '14px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '600',
                }}
              >
                To
              </div>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>
                {aircraft.arrival || 'UNK'}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              padding: '14px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '600',
                }}
              >
                Altitude MSL
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                {displayAltMSL}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '600',
                }}
              >
                Altitude AGL
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                {altAGL.toFixed(0)} ft
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '600',
                }}
              >
                V-Speed
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                {aircraft.vspeed || '0'} fpm
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '600',
                }}
              >
                Speed
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                {aircraft.speed?.toFixed(0)} kt
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '600',
                }}
              >
                Heading
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                {aircraft.heading?.toFixed(0)}°
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '600',
                }}
              >
                Squawk
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  fontFamily: 'monospace',
                }}
              >
                {aircraft.squawk || 'N/A'}
              </div>
            </div>
            {aircraft.nextWaypoint && (
              <div>
                <div
                  style={{
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.5)',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                  }}
                >
                  Next WPT
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>
                  {aircraft.nextWaypoint}
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            flexGrow: 1,
            overflowY: 'auto',
            marginTop: '16px',
          }}
        >
          {renderFlightPlan()}
        </div>
      </div>
    );
  }
);

DesktopSidebar.displayName = 'DesktopSidebar';