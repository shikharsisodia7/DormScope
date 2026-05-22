"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { API_URL } from "@/lib/utils";

// Fix default marker icons in Next.js
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface Pin {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  dormCount: number;
  avgCost: number | null;
}

export function USMap() {
  const [pins, setPins] = useState<Pin[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/colleges/map`)
      .then((r) => r.json())
      .then(setPins)
      .catch(() => setPins([]));
  }, []);

  if (!pins.length) {
    return <p className="text-muted-foreground">No map data — start API and seed database.</p>;
  }

  return (
    <div className="h-[600px] rounded-xl overflow-hidden border">
      <MapContainer center={[39.5, -98.35]} zoom={4} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={icon}>
            <Popup>
              <strong>{p.name}</strong>
              <br />
              {p.city}, {p.state}
              <br />
              {p.dormCount} dorms
              {p.avgCost && (
                <>
                  <br />
                  Avg ~${Math.round(p.avgCost).toLocaleString()}/yr
                </>
              )}
              <br />
              <Link href={`/colleges/${p.slug}`} className="text-primary text-sm">
                View housing →
              </Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
