/**
 * Källa till sanning för home_equipment.equipment_data-strukturer.
 *
 * Tabellen public.home_equipment i Supabase lagrar utrustning per fastighet
 * som key-value-par: equipment_key (text) + equipment_data (jsonb).
 *
 * Detta är typdefinitionen för equipment_data, indexerad på equipment_key.
 * När en ny equipment_key läggs till, lägg också till motsvarande interface
 * och utöka EquipmentKey-unionen och EquipmentDataMap nedan.
 *
 * V2-uppdatering (2026-05): row-typen använder home_property_id istället för 
 * anlaggnings_id. Skälet: V2-modellen har home_properties som primär entitet 
 * för "fastighet inom ett hem". Samma fysiska anlaggnings_id kan finnas i 
 * flera home_properties (en per hem som inkluderar fastigheten).
 *
 * Mattias' analyskod och frontend-formulär ska importera typer härifrån.
 */

// ---------------------------------------------------------------------------
// Equipment keys
// ---------------------------------------------------------------------------

export type EquipmentKey =
  | 'solar'
  | 'battery'
  | 'ev'
  | 'pool'
  | 'jacuzzi'
  | 'sauna'
  | 'underfloor_heating';


// ---------------------------------------------------------------------------
// Per-equipment interfaces
// ---------------------------------------------------------------------------

export interface SolarEquipment {
  installed_year: number;
  capacity_kw: number;
  orientation: 'south' | 'east' | 'west' | 'east_west' | 'mixed';
  panel_count?: number;
}

export interface BatteryEquipment {
  installed_year: number;
  capacity_kwh: number;
  manufacturer?: string;
}

export interface EVEquipment {
  home_charging: boolean;
  estimated_kwh_per_year?: number;
  charger_type?: '3.7kW' | '11kW' | '22kW';
  vehicle_count?: number;
}

export interface PoolEquipment {
  heated: boolean;
  size_m3?: number;
  covered_off_season?: boolean;
  heating_method?: 'heat_pump' | 'electric' | 'solar';
}

export interface JacuzziEquipment {
  size_liters?: number;
  year_round: boolean;
  heating_method?: 'electric' | 'heat_pump';
}

export interface SaunaEquipment {
  electric: boolean;
  frequency_per_week?: number;
  power_kw?: number;
}

export interface UnderfloorHeatingEquipment {
  area_m2?: number;
  powered_by?: 'heat_pump' | 'district' | 'electric_direct';
}


// ---------------------------------------------------------------------------
// Map from key to data type — möjliggör typad åtkomst
// ---------------------------------------------------------------------------

export interface EquipmentDataMap {
  solar: SolarEquipment;
  battery: BatteryEquipment;
  ev: EVEquipment;
  pool: PoolEquipment;
  jacuzzi: JacuzziEquipment;
  sauna: SaunaEquipment;
  underfloor_heating: UnderfloorHeatingEquipment;
}


// ---------------------------------------------------------------------------
// Hjälptyp för en hel equipment-rad (V2)
// ---------------------------------------------------------------------------

/**
 * V2: home_property_id är primär identifierare istället för anlaggnings_id.
 * Detta matchar databasstrukturen i public.home_equipment.
 */
export type EquipmentRow<K extends EquipmentKey = EquipmentKey> = {
  home_property_id: string;
  equipment_key: K;
  equipment_data: EquipmentDataMap[K];
  updated_by?: string | null;
  updated_at: string;
  created_at: string;
};


// ---------------------------------------------------------------------------
// Type guard: kör vid läsning från databasen för att smalna typen
// ---------------------------------------------------------------------------

export function isEquipmentKey(key: string): key is EquipmentKey {
  return [
    'solar',
    'battery',
    'ev',
    'pool',
    'jacuzzi',
    'sauna',
    'underfloor_heating',
  ].includes(key);
}
