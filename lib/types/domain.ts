/**
 * V2 domän-typer — för användning i UI-komponenter och business-logik.
 *
 * Skillnader mot databas-typer i database.ts:
 * - camelCase istället för snake_case
 * - Date-objekt istället för ISO-strings
 * - Nullable-fält som T | undefined istället för T | null
 * - Vissa nästlade strukturer (Address inuti HomeProperty) istället för FK
 *
 * Konvertering: använd mappers.ts för att gå från Db* → domän-typer.
 */

import type {
  HomeRole,
  PropertyType,
  DocumentType,
  AnalysisType,
  ConsumptionGranularity,
  SEZone,
} from "./database";

import type { EquipmentKey, EquipmentDataMap } from "./home-equipment";

// Re-exportera enum-typer för bekvämlighet
export type { HomeRole, PropertyType, DocumentType, AnalysisType, ConsumptionGranularity, SEZone };

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

export interface Address {
  id: string;
  street: string;
  postalCode: string;
  city: string;
  kommun?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Home (kuraterad sammanställning)
// ---------------------------------------------------------------------------

export interface Home {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean; // härledd från deleted_at
}

/**
 * Home med utökad info om medlemmar och fastigheter.
 * För dashboard-vy där man vill visa hela hemmets struktur i en query.
 */
export interface HomeWithDetails extends Home {
  members: HomeMember[];
  properties: HomeProperty[];
  /** Användarens roll i detta hem */
  myRole: HomeRole;
}

// ---------------------------------------------------------------------------
// HomeMember
// ---------------------------------------------------------------------------

export interface HomeMember {
  homeId: string;
  userId: string;
  role: HomeRole;
  joinedAt: Date;
  /** Om left_at är satt = inaktiv medlem */
  leftAt?: Date;
  isActive: boolean; // härledd: !leftAt
}

// ---------------------------------------------------------------------------
// HomeInvitation
// ---------------------------------------------------------------------------

export interface HomeInvitation {
  id: string;
  homeId: string;
  invitedBy: string;
  invitedEmail: string;
  role: Exclude<HomeRole, "owner">;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
  // Härledda
  isExpired: boolean;
  isAccepted: boolean;
}

// ---------------------------------------------------------------------------
// HomeProperty (verklig eller fiktiv fastighet)
// ---------------------------------------------------------------------------

interface HomePropertyBase {
  id: string;
  homeId: string;
  type: PropertyType;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

/** Verklig fastighet med anlaggnings_id */
export interface RealHomeProperty extends HomePropertyBase {
  type: "real";
  anlaggningsId: string;
  /** Adress nästlad istället för FK för enklare användning i UI */
  address?: Address;
  zone?: SEZone;
  networkOperator?: string;
  country: string;
}

/** Fiktiv fastighet (scenario-analys) */
export interface HypotheticalHomeProperty extends HomePropertyBase {
  type: "hypothetical";
  hypotheticalName: string;
}

export type HomeProperty = RealHomeProperty | HypotheticalHomeProperty;

// Type guards
export function isRealProperty(prop: HomeProperty): prop is RealHomeProperty {
  return prop.type === "real";
}

export function isHypotheticalProperty(prop: HomeProperty): prop is HypotheticalHomeProperty {
  return prop.type === "hypothetical";
}

// ---------------------------------------------------------------------------
// HomePropertyProduction (solceller)
// ---------------------------------------------------------------------------

export interface HomePropertyProduction {
  id: string;
  homePropertyId: string;
  productionAnlaggningsId: string;
  installedKw?: number;
  installationYear?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Document (faktura eller offert)
// ---------------------------------------------------------------------------

export interface Document {
  id: string;
  documentType: DocumentType;
  uploadedBy?: string;
  pdfStoragePath?: string;
  parsedData?: unknown;
  // Denormaliserade fält
  totalKr?: number;
  consumptionKwh?: number;
  spotPriceOreKwh?: number;
  electricitySupplier?: string;
  invoicePeriodStart?: Date;
  invoicePeriodEnd?: Date;
  parserConfidence?: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

/** Document med vilka home_properties det är kopplat till (M:N) */
export interface DocumentWithLinks extends Document {
  homePropertyIds: string[];
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export interface Analysis {
  id: string;
  documentId: string;
  analysisType: AnalysisType;
  modelVersion: string;
  result: unknown;
  rawResponse?: unknown;
  isReference: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// ConsumptionData (granular kWh)
// ---------------------------------------------------------------------------

export interface ConsumptionDataPoint {
  id: string;
  homePropertyId: string;
  granularity: ConsumptionGranularity;
  periodStart: Date;
  periodEnd: Date;
  kwh: number;
  source?: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// HomeProfile (boyta, byggår, etc.)
// ---------------------------------------------------------------------------

export interface HomeProfile {
  homePropertyId: string;
  livingAreaM2?: number;
  buildingYear?: number;
  buildingType?: string;
  heatingType?: string;
  numResidents?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// HomeEquipment
// ---------------------------------------------------------------------------

/**
 * HomeEquipment med typad data per equipment_key.
 * Använder EquipmentDataMap från home-equipment.ts.
 */
export interface HomeEquipment<K extends EquipmentKey = EquipmentKey> {
  homePropertyId: string;
  equipmentKey: K;
  equipmentData: EquipmentDataMap[K];
  createdAt: Date;
  updatedAt: Date;
}
