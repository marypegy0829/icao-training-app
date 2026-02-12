
import { supabase } from './supabaseClient';

export interface Airport {
    id: string;
    icao_code: string;
    iata_code: string;
    name: string;
    city: string;
    country: string;
    region_code: string;
    elevation_ft: number;
    image_url?: string;
    runways: string[]; // JSONB parsed as array e.g. ["36R", "18L"]
    frequencies: { [key: string]: string }; // e.g. {"TOWER": "118.1"}
    // New Fields
    procedures?: {
        sids: string[];  // Standard Instrument Departures e.g. ["KENNEDY5", "BETTE3"]
        stars: string[]; // Standard Terminal Arrival Routes
    };
    taxi_routes?: {
        [key: string]: string; // e.g. "Gate to 36R": "A, B, Hold Short K"
    };
}

export const airportService = {
    // Get airport by ICAO code (e.g. ZBAA)
    async getAirportByCode(code: string): Promise<Airport | null> {
        if (!code) return null;
        
        const { data, error } = await supabase
            .from('airports')
            .select('*')
            .eq('icao_code', code.toUpperCase())
            .single();

        if (error) {
            if (error.code !== 'PGRST116') {
                 console.warn(`Error fetching airport ${code}:`, error);
            }
            return null;
        }

        return data as Airport;
    },

    // Search airports by name or code
    async searchAirports(query: string): Promise<Airport[]> {
        if (!query || query.length < 2) return [];

        const { data, error } = await supabase
            .from('airports')
            .select('*')
            .or(`icao_code.ilike.%${query}%,iata_code.ilike.%${query}%,city.ilike.%${query}%`)
            .limit(10); 
            
        if (error) {
            console.warn('Airport search failed:', error);
            return [];
        }
        return data as Airport[];
    },

    // Get a random airport ID to fetch (for random training)
    // Note: Supabase doesn't support ORDER BY RANDOM() efficiently on large tables without RPC,
    // but for 100 rows, fetching ID list is cheap.
    async getRandomAirport(): Promise<Airport | null> {
        const { data, error } = await supabase
            .from('airports')
            .select('icao_code');
        
        if (error || !data || data.length === 0) return null;
        
        const randomCode = data[Math.floor(Math.random() * data.length)].icao_code;
        return this.getAirportByCode(randomCode);
    }
};
