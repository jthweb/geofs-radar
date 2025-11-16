import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { type PositionUpdate } from '~/lib/aircraft-store';

interface MapComponentProps {
  aircrafts: PositionUpdate[];
  airports: Airport[];
  onAircraftSelect: (aircraft: PositionUpdate | null) => void;
}

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
}

interface METARData {
  icao: string;
  name: string;
  metar: string;
  timestamp: string;
}

let mapInstance: L.Map | null = null;
let flightPlanLayerGroup: L.LayerGroup | null = null;
let isInitialLoad = true;

const WaypointIcon = L.divIcon({
  html: '<div style="font-size: 16px; font-weight: bold; color: #f54291; text-shadow: 0 0 2px #000;">X</div>',
  className: 'leaflet-waypoint-icon',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const ActiveWaypointIcon = L.divIcon({
  html: '<div style="font-size: 16px; font-weight: bold; color: #00ff00; text-shadow: 0 0 4px #000; animation: pulse-active 1.5s ease-in-out infinite;">▲</div>',
  className: 'leaflet-active-waypoint-icon',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const getAircraftDivIcon = (aircraft: PositionUpdate) => {
  const iconUrl = 'https://i.ibb.co/6cNhyMMj/1.png';
  const planeSize = 30;
  const tagHeight = 45;
  const tagWidth = 150;
  const tagHorizontalSpacing = 10;

  const iconWidth = planeSize + tagHorizontalSpacing + tagWidth;
  const iconHeight = Math.max(planeSize, tagHeight);

  const anchorX = planeSize / 2;
  const anchorY = iconHeight / 2;

  const containerStyle = `
    position: absolute;
    top: ${(iconHeight - planeSize) / 2}px;
    left: 0;
    width: ${planeSize}px;
    height: ${planeSize}px;
  `;

  const tagStyle = `
    position: absolute;
    top: ${(planeSize / 2) - (tagHeight / 2)}px;
    left: ${planeSize + tagHorizontalSpacing}px;

    width: ${tagWidth}px;
    padding: 4px 6px;
    background-color: rgba(0, 0, 0, 0.4);
    color: #fff;
    border-radius: 4px;
    white-space: normal;
    text-align: center;
    box-shadow: 0 1px 4px rgba(0,0,0,0.6);
    line-height: 1.3;
    z-index: 1000;
    pointer-events: none;
    transform: none;
  `;

  const detailContent = `
    <div style="font-size: 12px; font-weight: bold; color: #fff;">
      ${aircraft.callsign || aircraft.flightNo || 'N/A'} (${aircraft.flightNo || 'N/A'})
    </div>
    <div style="font-size: 10px; opacity: 0.9;">
      ${aircraft.alt.toFixed(0)}ft | HDG ${aircraft.heading.toFixed(0)}° | ${aircraft.speed.toFixed(0)}kt
    </div>
    <div style="font-size: 10px; opacity: 0.8;">
      SQK: ${aircraft.squawk || 'N/A'} | ${aircraft.departure || 'UNK'} → ${aircraft.arrival || 'UNK'}
    </div>
  `;

  return L.divIcon({
    html: `
      <div style="${containerStyle}" class="aircraft-marker-container">
        <img src="${iconUrl}"
             style="width:${planeSize}px; height:${planeSize}px; transform:rotate(${aircraft.heading || 0}deg); display: block;"
             alt="${aircraft.callsign}"
        />
        <div class="aircraft-tag" style="${tagStyle}">
          ${detailContent}
        </div>
      </div>
    `,
    className: 'leaflet-aircraft-icon',
    iconSize: [iconWidth, iconHeight],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -15],
  });
};

const AirportIcon = L.icon({
  iconUrl: 'https://i0.wp.com/microshare.io/wp-content/uploads/2024/04/airport2-icon.png?resize=510%2C510&ssl=1',
  iconSize: [30, 30],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const toDeg = (rad: number) => rad * 180 / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = toDeg(Math.atan2(y, x));

  return (θ + 360) % 360;
};

const findActiveWaypointIndex = (aircraft: PositionUpdate, waypoints: any[]): number => {
  if (waypoints.length < 1) return -1;

  const currentLat = aircraft.lat;
  const currentLon = aircraft.lon;

  let closestWaypointIndex = -1;
  let minDistanceKm = Infinity;

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (!wp.lat || !wp.lon) continue;

    const distance = calculateDistance(currentLat, currentLon, wp.lat, wp.lon);

    if (distance < minDistanceKm) {
      minDistanceKm = distance;
      closestWaypointIndex = i;
    }
  }

  if (minDistanceKm < 50 && closestWaypointIndex < waypoints.length - 1) {
    return closestWaypointIndex + 1;
  }

  return closestWaypointIndex;
};

class HeadingModeControl extends L.Control {
  public options = {
    position: 'topleft' as L.ControlPosition,
  };
  public _container: HTMLDivElement | null = null;
  private _toggleHeadingMode: React.Dispatch<React.SetStateAction<boolean>>;
  private _boundClickHandler: (event: Event) => void;

  constructor(options: L.ControlOptions, toggleHeadingMode: React.Dispatch<React.SetStateAction<boolean>>) {
    super(options);
    this._toggleHeadingMode = toggleHeadingMode;
    this._boundClickHandler = (event: Event) => {
      this._toggleHeadingMode((prev) => !prev);
    };
  }

  onAdd(map: L.Map): HTMLDivElement {
    const container = L.DomUtil.create('div');
    container.className =
      'leaflet-bar leaflet-control w-[30px] h-[30px] leading-[30px] text-center cursor-pointer shadow-md rounded-md transition-colors duration-200';
    container.title = 'Toggle Heading Mode';
    container.innerHTML = '&#8599;';

    L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
    L.DomEvent.on(container, 'click', L.DomEvent.preventDefault);
    L.DomEvent.on(container, 'click', this._boundClickHandler);
    this._container = container;
    return container;
  }

  onRemove(map: L.Map) {
    if (this._container) {
      L.DomEvent.off(this._container, 'click', this._boundClickHandler);
    }
  }

  updateState(enabled: boolean) {
    if (this._container) {
      if (enabled) {
        L.DomUtil.removeClass(this._container, 'bg-white');
        L.DomUtil.addClass(this._container, 'bg-blue-500');
        L.DomUtil.addClass(this._container, 'text-white');
      } else {
        L.DomUtil.removeClass(this._container, 'bg-blue-500');
        L.DomUtil.removeClass(this._container, 'text-white');
        L.DomUtil.addClass(this._container, 'bg-white');
      }
    }
  }
}

class METARControl extends L.Control {
  public options = {
    position: 'bottomright' as L.ControlPosition,
  };
  public _container: HTMLDivElement | null = null;
  private _isExpanded = false;
  private _inputElement: HTMLInputElement | null = null;
  private _contentElement: HTMLDivElement | null = null;
  private _loadingElement: HTMLDivElement | null = null;

  constructor(options: L.ControlOptions = {}) {
    super(options);
  }

  onAdd(map: L.Map): HTMLDivElement {
    const container = L.DomUtil.create('div', 'leaflet-metar-control');
    
    container.innerHTML = `
      <div class="metar-toggle bg-white shadow-md rounded-md p-2 cursor-pointer border-2 border-gray-300 hover:bg-gray-50 transition-colors duration-200" title="METAR Weather Information">
        <div class="text-sm font-semibold text-gray-700">METAR</div>
      </div>
      <div class="metar-panel hidden bg-white shadow-lg rounded-md border-2 border-gray-300 mt-2 w-80 max-h-96 overflow-hidden">
        <div class="p-3 border-b bg-gray-50">
          <div class="flex items-center gap-2">
            <input 
              type="text" 
              placeholder="Enter ICAO code (e.g., KJFK)" 
              class="metar-input flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
              maxlength="4"
            />
            <button class="metar-search bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm transition-colors duration-200">
              Search
            </button>
          </div>
        </div>
        <div class="metar-content p-3 max-h-64 overflow-y-auto">
          <div class="text-gray-500 text-sm text-center">Enter an ICAO code to get METAR weather information</div>
        </div>
        <div class="metar-loading hidden p-3 text-center">
          <div class="text-sm text-gray-600">Loading METAR data...</div>
        </div>
      </div>
    `;

    const toggle = container.querySelector('.metar-toggle') as HTMLDivElement;
    const panel = container.querySelector('.metar-panel') as HTMLDivElement;
    const input = container.querySelector('.metar-input') as HTMLInputElement;
    const searchButton = container.querySelector('.metar-search') as HTMLDivElement;
    const content = container.querySelector('.metar-content') as HTMLDivElement;
    const loading = container.querySelector('.metar-loading') as HTMLDivElement;

    this._inputElement = input;
    this._contentElement = content;
    this._loadingElement = loading;

    const togglePanel = (event: Event) => {
      event.stopPropagation();
      this._isExpanded = !this._isExpanded;
      
      if (this._isExpanded) {
        panel.classList.remove('hidden');
        input.focus();
      } else {
        panel.classList.add('hidden');
      }
    };

    const searchMETAR = async (event: Event) => {
      event.stopPropagation();
      const icao = input.value.trim().toUpperCase();
      
      if (!icao || icao.length !== 4) {
        this.showError('Please enter a valid 4-letter ICAO code');
        return;
      }

      await this.fetchMETARData(icao);
    };

    const handleKeyPress = (event: Event) => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key === 'Enter') {
        searchMETAR(event);
      }
    };

    L.DomEvent.on(toggle, 'click', togglePanel);
    L.DomEvent.on(searchButton, 'click', searchMETAR);
    L.DomEvent.on(input, 'keypress', handleKeyPress);
    
    L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
    L.DomEvent.on(container, 'mousedown', L.DomEvent.stopPropagation);
    L.DomEvent.on(container, 'dblclick', L.DomEvent.stopPropagation);

    this._container = container;
    return container;
  }

  onRemove(map: L.Map) {
  }

  private async fetchMETARData(icao: string) {
    if (!this._contentElement || !this._loadingElement) return;

    this._contentElement.classList.add('hidden');
    this._loadingElement.classList.remove('hidden');

    try {
      const response = await this.fetchRealMETARData(icao);
      
      if (response.success && response.data) {
        this.displayMETARData(response.data);
      } else {
        this.showError(response.message || 'METAR data not found for this airport');
      }
    } catch (error) {
      console.error('Error fetching METAR data:', error);
      this.showError('Failed to fetch METAR data. Please try again.');
    } finally {
      this._loadingElement.classList.add('hidden');
      this._contentElement.classList.remove('hidden');
    }
  }

  private async fetchRealMETARData(icao: string): Promise<{ success: boolean; data?: METARData; message?: string }> {
    try {
      const response = await fetch(`https://aviationweather.gov/cgi-bin/data/metar.php?ids=${icao}&format=raw&hours=0&taf=off&layout=off&date=0`, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.text();
      
      if (data && data.trim() !== '' && !data.includes('No METAR')) {
        const lines = data.trim().split('\n');
        let metarLine = '';
        
        for (const line of lines) {
          if (line.includes(icao.toUpperCase())) {
            metarLine = line;
            break;
          }
        }
        
        if (metarLine) {
          return {
            success: true,
            data: {
              icao: icao.toUpperCase(),
              name: `Airport ${icao.toUpperCase()}`,
              metar: metarLine.trim(),
              timestamp: new Date().toISOString()
            }
          };
        } else {
          return {
            success: false,
            message: 'No METAR data available for this airport'
          };
        }
      } else {
        return {
          success: false,
          message: 'No METAR data available for this airport'
        };
      }
    } catch (error) {
      console.error('METAR fetch error:', error);
      return {
        success: false,
        message: 'Failed to fetch METAR data. The airport code may not exist or the service is temporarily unavailable.'
      };
    }
  }

  private displayMETARData(data: METARData) {
    if (!this._contentElement) return;

    const timeAgo = this.getTimeAgo(new Date(data.timestamp));
    const decodedMETAR = this.decodeMETAR(data.metar);
    
    this._contentElement.innerHTML = `
      <div class="space-y-3">
        <div class="border-b pb-2">
          <div class="font-semibold text-gray-800">${data.name}</div>
          <div class="text-sm text-gray-600">${data.icao}</div>
          <div class="text-xs text-gray-500">Updated ${timeAgo}</div>
        </div>
        <div class="space-y-2">
          <div class="bg-gray-50 p-3 rounded text-sm font-mono leading-relaxed">
            ${data.metar}
          </div>
          ${decodedMETAR ? `
            <div class="bg-blue-50 p-3 rounded text-sm">
              <div class="font-semibold text-blue-800 mb-2">Decoded:</div>
              <div class="space-y-1 text-blue-700">
                ${decodedMETAR}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private decodeMETAR(metar: string): string {
    try {
      const parts = metar.split(' ').filter(part => part.length > 0);
      let decoded = '';
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        
        if (/^\d{6}Z$/.test(part)) {
          const day = part.slice(0, 2);
          const hour = part.slice(2, 4);
          const minute = part.slice(4, 6);
          decoded += `<div>Time: ${day}th at ${hour}:${minute} UTC</div>`;
        }
        
        if (/^\d{5}(G\d{2,3})?KT$/.test(part)) {
          const direction = part.slice(0, 3);
          const speed = part.slice(3, 5);
          const gust = part.includes('G') ? part.slice(part.indexOf('G') + 1, part.indexOf('KT')) : null;
          decoded += `<div>Wind: ${direction}° at ${speed}kt${gust ? ` gusting ${gust}kt` : ''}</div>`;
        }
        
        if (/^\d{1,2}SM$/.test(part) || (/^\d{4}$/.test(part) && parseInt(part) > 1000)) {
          const visibility = part.includes('SM') ? part : `${parseInt(part)}m`;
          decoded += `<div>Visibility: ${visibility}</div>`;
        }
        
        if (/^(FEW|SCT|BKN|OVC)\d{3}$/.test(part)) {
          const type = part.slice(0, 3);
          const height = parseInt(part.slice(3)) * 100;
          const cloudType: { [key: string]: string } = {
            'FEW': 'Few',
            'SCT': 'Scattered',
            'BKN': 'Broken',
            'OVC': 'Overcast'
          };
          decoded += `<div>Clouds: ${cloudType[type] || type} at ${height}ft</div>`;
        }
        
        if (/^M?\d{2}\/M?\d{2}$/.test(part)) {
          const tempParts = part.split('/');
          if (tempParts.length === 2) {
            const temp = tempParts[0].replace('M', '-');
            const dewpoint = tempParts[1].replace('M', '-');
            decoded += `<div>Temperature: ${temp}°C, Dewpoint: ${dewpoint}°C</div>`;
          }
        }
        
        if (/^A\d{4}$/.test(part)) {
          const altimeter = (parseInt(part.slice(1)) / 100).toFixed(2);
          decoded += `<div>Altimeter: ${altimeter}" Hg</div>`;
        }
        
        if (/^Q\d{4}$/.test(part)) {
          const qnh = part.slice(1);
          decoded += `<div>QNH: ${qnh} hPa</div>`;
        }

        if (/^(RA|SN|DZ|FG|BR|HZ|FU|VA|DU|SA|PY)$/.test(part) || 
            /^-?(RA|SN|DZ|FG|BR|HZ|FU|VA|DU|SA|PY)$/.test(part) ||
            /^\+?(RA|SN|DZ|FG|BR|HZ|FU|VA|DU|SA|PY)$/.test(part)) {
          const weatherCodes: { [key: string]: string } = {
            'RA': 'Rain',
            'SN': 'Snow',
            'DZ': 'Drizzle',
            'FG': 'Fog',
            'BR': 'Mist',
            'HZ': 'Haze',
            'FU': 'Smoke',
            'VA': 'Volcanic Ash',
            'DU': 'Dust',
            'SA': 'Sand',
            'PY': 'Spray'
          };
          const intensity = part.startsWith('-') ? 'Light ' : part.startsWith('+') ? 'Heavy ' : '';
          const code = part.replace(/^[-+]/, '');
          if (weatherCodes[code]) {
            decoded += `<div>Weather: ${intensity}${weatherCodes[code]}</div>`;
          }
        }
      }
      
      return decoded;
    } catch (error) {
      return '';
    }
  }

  private showError(message: string) {
    if (!this._contentElement) return;

    this._contentElement.innerHTML = `
      <div class="text-center text-red-600 text-sm">
        <div class="mb-2">⚠️</div>
        <div>${message}</div>
      </div>
    `;
  }

  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  }
}

const MapComponent: React.FC<MapComponentProps> = ({
  aircrafts,
  airports,
  onAircraftSelect,
}) => {
  const [isHeadingMode, setIsHeadingMode] = useState<boolean>(false);
  const headingStartPointRef = useRef<L.LatLng | null>(null);
  const headingLineRef = useRef<L.Polyline | null>(null);
  const headingTooltipRef = useRef<L.Tooltip | null>(null);
  const headingMarkerRef = useRef<L.Marker | null>(null);
  const headingControlRef = useRef<HeadingModeControl | null>(null);

  useEffect(() => {
    if (!mapInstance) return;

    const headingControl = new HeadingModeControl(
      {},
      setIsHeadingMode,
    );
    mapInstance.addControl(headingControl);
    headingControlRef.current = headingControl;

    const metarControl = new METARControl();
    mapInstance.addControl(metarControl);

    return () => {
      mapInstance?.removeControl(headingControl);
      mapInstance?.removeControl(metarControl);
    };
  }, []);

  useEffect(() => {
    if (headingControlRef.current) {
      headingControlRef.current.updateState(isHeadingMode);
    }
  }, [isHeadingMode]);

  useEffect(() => {
    if (!mapInstance) {
      mapInstance = L.map('map-container', {
        zoomAnimation: true,
      }).setView([20, 0], 2);

      L.tileLayer('https://mt0.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        attribution: 'Esri, Garmin, FAO, USGS, NPS',
        maxZoom: 18,
        transparent: true,
        pane: 'overlayPane',
      }).addTo(mapInstance);

      flightPlanLayerGroup = L.layerGroup().addTo(mapInstance);

      mapInstance.on('click', (e) => {
        const target = e.originalEvent.target as HTMLElement;
        if (
          !target.closest('.leaflet-marker-icon') &&
          !target.closest('.leaflet-popup-pane') &&
          !target.closest('.leaflet-control') &&
          flightPlanLayerGroup
        ) {
          flightPlanLayerGroup.clearLayers();
          onAircraftSelect(null);
        }
      });
    }

    mapInstance.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapInstance?.removeLayer(layer);
      }
    });

    airports.forEach((airport) => {
      const popupContent = `**Airport:** ${airport.name}<br>(${airport.icao})`;

      L.marker([airport.lat, airport.lon], {
        title: airport.name,
        icon: AirportIcon,
      })
        .addTo(mapInstance!)
        .bindPopup(popupContent);
    });

    const drawFlightPlan = (aircraft: PositionUpdate) => {
      if (!mapInstance || !aircraft.flightPlan || !flightPlanLayerGroup) return;

      try {
        flightPlanLayerGroup.clearLayers();

        const waypoints = JSON.parse(aircraft.flightPlan);

        if (waypoints.length === 0) return;

        const activeWaypointIndex = findActiveWaypointIndex(
          aircraft,
          waypoints,
        );
        const coordinates: L.LatLngTuple[] = [];

        waypoints.forEach((wp: any, index: number) => {
          if (wp.lat && wp.lon) {
            coordinates.push([wp.lat, wp.lon]);

            const popupContent = `
                        <strong>Waypoint: ${wp.ident}</strong> (${wp.type})<br>
                        Altitude: ${wp.alt ? wp.alt + ' ft' : 'N/A'}<br>
                        Speed: ${wp.spd ? wp.spd + ' kt' : 'N/A'}
                    `;

            const icon =
              index === activeWaypointIndex ? ActiveWaypointIcon : WaypointIcon;

            const waypointMarker = L.marker([wp.lat, wp.lon], {
              icon: icon,
              title: wp.ident,
            })
              .bindPopup(popupContent)
              .addTo(flightPlanLayerGroup!);

            waypointMarker.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
            });
          }
        });

        if (coordinates.length < 2) return;

        const polyline = L.polyline(coordinates, {
          color: '#ff00ff',
          weight: 5,
          opacity: 0.7,
          dashArray: '10, 5',
        });

        flightPlanLayerGroup.addLayer(polyline);

        mapInstance.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      } catch (error) {
        console.error('Error drawing flight plan:', error);
      }
    };

    aircrafts.forEach((aircraft) => {
      const icon = getAircraftDivIcon(aircraft);

      const marker = L.marker([aircraft.lat, aircraft.lon], {
        title: aircraft.callsign,
        icon: icon,
      }).addTo(mapInstance!);

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        drawFlightPlan(aircraft);
        onAircraftSelect(aircraft);
      });
    });

    isInitialLoad = false;
  }, [aircrafts, airports, onAircraftSelect]);

  useEffect(() => {
    if (!mapInstance) return;

    const map = mapInstance;

    const handleMouseDown = (e: L.LeafletMouseEvent) => {
      if (!isHeadingMode) return;
      headingStartPointRef.current = e.latlng;

      if (headingMarkerRef.current) {
        map.removeLayer(headingMarkerRef.current);
      }
      headingMarkerRef.current = L.marker(e.latlng, {
        icon: L.divIcon({
          className: '',
          html: '<div class="bg-blue-600 w-[10px] h-[10px] rounded-full"></div>',
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        }),
      }).addTo(map);

      map.dragging.disable();
    };

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (!isHeadingMode || !headingStartPointRef.current) return;

      const start = headingStartPointRef.current;
      const end = e.latlng;

      if (headingLineRef.current) {
        headingLineRef.current.setLatLngs([start, end]);
      } else {
        headingLineRef.current = L.polyline([start, end], {
          color: 'blue',
          weight: 3,
          dashArray: '5, 5',
        }).addTo(map);
      }

      const distance = calculateDistance(
        start.lat,
        start.lng,
        end.lat,
        end.lng,
      );
      const heading = calculateBearing(
        start.lat,
        start.lng,
        end.lat,
        end.lng,
      );

      const tooltipContent = `
        <div class="font-bold">
          Heading: ${heading.toFixed(1)}°
        </div>
        <div>
          Distance: ${distance.toFixed(1)} km
        </div>
      `;

      if (headingTooltipRef.current) {
        headingTooltipRef.current.setLatLng(end).setContent(tooltipContent);
      } else {
        headingTooltipRef.current = L.tooltip({
          permanent: true,
          direction: 'auto',
          className:
            'bg-black bg-opacity-70 text-white border-none rounded-md p-2 text-sm shadow-md pointer-events-none leaflet-tooltip-tip-hidden',
        })
          .setLatLng(end)
          .setContent(tooltipContent)
          .addTo(map);
      }
    };

    const handleMouseUp = () => {
      if (!isHeadingMode) return;

      if (headingLineRef.current) {
        map.removeLayer(headingLineRef.current);
        headingLineRef.current = null;
      }
      if (headingTooltipRef.current) {
        map.removeLayer(headingTooltipRef.current);
        headingTooltipRef.current = null;
      }
      if (headingMarkerRef.current) {
        map.removeLayer(headingMarkerRef.current);
        headingMarkerRef.current = null;
      }

      headingStartPointRef.current = null;
      map.dragging.enable();
    };

    if (isHeadingMode) {
      map.on('mousedown', handleMouseDown);
      map.on('mousemove', handleMouseMove);
      map.on('mouseup', handleMouseUp);
      L.DomUtil.addClass(map.getContainer(), 'cursor-crosshair');
    } else {
      if (headingLineRef.current) {
        map.removeLayer(headingLineRef.current);
        headingLineRef.current = null;
      }
      if (headingTooltipRef.current) {
        map.removeLayer(headingTooltipRef.current);
        headingTooltipRef.current = null;
      }
      if (headingMarkerRef.current) {
        map.removeLayer(headingMarkerRef.current);
        headingMarkerRef.current = null;
      }
      headingStartPointRef.current = null;

      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.dragging.enable();
      L.DomUtil.removeClass(map.getContainer(), 'cursor-crosshair');
    }

    return () => {
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.dragging.enable();
      L.DomUtil.removeClass(map.getContainer(), 'cursor-crosshair');
    };
  }, [isHeadingMode]);

  return <div id="map-container" style={{ height: '100%', width: '100%' }} />;
};

export default MapComponent;