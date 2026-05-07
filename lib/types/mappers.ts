/**
 * V2 mappers — konvertera mellan databas-typer (database.ts) och domän-typer (domain.ts).
 *
 * Konvention:
 * - `fromDb*`: konvertera från databas-rad till domän-objekt
 *   (snake_case → camelCase, ISO-string → Date, null → undefined, härled bool-fält)
 * - `toDb*`: konvertera tillbaka — bara där det behövs (INSERT/UPDATE)
 *
 * Vi har bara `fromDb*`-mappers i utgångsläget. `toDb*` läggs till per behov.
 *
 * Datum-konvertering: vi tolkar ISO-strings som UTC. Postgres timestamptz är
 * alltid UTC i raden, även om visning sker i lokal tid.
 */

import type {
  DbAddress,
  DbHome,
  DbHomeMember,
  DbHomeInvitation,
  DbHomeProperty,
  DbHomePropertyProduction,
  DbDocument,
  DbAnalysis,
  DbConsumptionData,
  DbHomeProfile,
  DbHomeEquipment,
} from "./database";

import type {
  Address,
  Home,
  HomeMember,
  HomeInvitation,
  HomeProperty,
  RealHomeProperty,
  HypotheticalHomeProperty,
  HomePropertyProduction,
  Document,
  Analysis,
  ConsumptionDataPoint,
  HomeProfile,
  HomeEquipment,
} from "./domain";

import type { EquipmentKey, EquipmentDataMap } from "./home-equipment";
import { isEquipmentKey } from "./home-equipment";

// ---------------------------------------------------------------------------
// Hjälpfunktioner
// ---------------------------------------------------------------------------

/** Konvertera ISO-string till Date. Postgres timestamptz returneras som ISO-string. */
function toDate(s: string): Date {
  return new Date(s);
}

/** Konvertera nullable ISO-string till Date | undefined */
function toDateOpt(s: string | null): Date | undefined {
  return s == null ? undefined : new Date(s);
}

/** Konvertera null → undefined för enklare användning */
function nullToUndef<T>(v: T | null): T | undefined {
  return v == null ? undefined : v;
}

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

export function fromDbAddress(row: DbAddress): Address {
  return {
    id: row.id,
    street: row.street,
    postalCode: row.postal_code,
    city: row.city,
    kommun: nullToUndef(row.kommun),
    country: row.country,
    latitude: nullToUndef(row.latitude),
    longitude: nullToUndef(row.longitude),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export function fromDbHome(row: DbHome): Home {
  return {
    id: row.id,
    name: row.name,
    description: nullToUndef(row.description),
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    isDeleted: row.deleted_at != null,
  };
}

// ---------------------------------------------------------------------------
// HomeMember
// ---------------------------------------------------------------------------

export function fromDbHomeMember(row: DbHomeMember): HomeMember {
  return {
    homeId: row.home_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: toDate(row.joined_at),
    leftAt: toDateOpt(row.left_at),
    isActive: row.left_at == null,
  };
}

// ---------------------------------------------------------------------------
// HomeInvitation
// ---------------------------------------------------------------------------

export function fromDbHomeInvitation(row: DbHomeInvitation): HomeInvitation {
  const expiresAt = toDate(row.expires_at);
  const acceptedAt = toDateOpt(row.accepted_at);
  return {
    id: row.id,
    homeId: row.home_id,
    invitedBy: row.invited_by,
    invitedEmail: row.invited_email,
    role: row.role,
    token: row.token,
    expiresAt,
    acceptedAt,
    createdAt: toDate(row.created_at),
    isExpired: expiresAt < new Date(),
    isAccepted: acceptedAt != null,
  };
}

// ---------------------------------------------------------------------------
// HomeProperty (med Address nästlad)
// ---------------------------------------------------------------------------

/**
 * fromDbHomeProperty kräver address-raden separat eftersom den hämtas via JOIN
 * eller separat query. Om address inte är medfölj (t.ex. en hypothetical 
 * fastighet som inte har adress), pass null.
 */
export function fromDbHomeProperty(
  row: DbHomeProperty,
  address: DbAddress | null,
): HomeProperty {
  const base = {
    id: row.id,
    homeId: row.home_id,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    isDeleted: row.deleted_at != null,
  };

  if (row.property_type === "real") {
    if (row.anlaggnings_id == null) {
      throw new Error(
        `home_property ${row.id} har property_type='real' men anlaggnings_id saknas`,
      );
    }
    const real: RealHomeProperty = {
      ...base,
      type: "real",
      anlaggningsId: row.anlaggnings_id,
      address: address ? fromDbAddress(address) : undefined,
      zone: nullToUndef(row.zone),
      networkOperator: nullToUndef(row.network_operator),
      country: row.country,
    };
    return real;
  } else {
    // hypothetical
    if (row.hypothetical_name == null) {
      throw new Error(
        `home_property ${row.id} har property_type='hypothetical' men hypothetical_name saknas`,
      );
    }
    const hypothetical: HypotheticalHomeProperty = {
      ...base,
      type: "hypothetical",
      hypotheticalName: row.hypothetical_name,
    };
    return hypothetical;
  }
}

// ---------------------------------------------------------------------------
// HomePropertyProduction
// ---------------------------------------------------------------------------

export function fromDbHomePropertyProduction(
  row: DbHomePropertyProduction,
): HomePropertyProduction {
  return {
    id: row.id,
    homePropertyId: row.home_property_id,
    productionAnlaggningsId: row.production_anlaggnings_id,
    installedKw: nullToUndef(row.installed_kw),
    installationYear: nullToUndef(row.installation_year),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function fromDbDocument(row: DbDocument): Document {
  return {
    id: row.id,
    documentType: row.document_type,
    uploadedBy: nullToUndef(row.uploaded_by),
    pdfStoragePath: nullToUndef(row.pdf_storage_path),
    parsedData: row.parsed_data,
    totalKr: nullToUndef(row.total_kr),
    consumptionKwh: nullToUndef(row.consumption_kwh),
    spotPriceOreKwh: nullToUndef(row.spot_price_ore_kwh),
    electricitySupplier: nullToUndef(row.electricity_supplier),
    invoicePeriodStart: toDateOpt(row.invoice_period_start),
    invoicePeriodEnd: toDateOpt(row.invoice_period_end),
    parserConfidence: nullToUndef(row.parser_confidence),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    isDeleted: row.deleted_at != null,
  };
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export function fromDbAnalysis(row: DbAnalysis): Analysis {
  return {
    id: row.id,
    documentId: row.document_id,
    analysisType: row.analysis_type,
    modelVersion: row.model_version,
    result: row.result,
    rawResponse: nullToUndef(row.raw_response),
    isReference: row.is_reference,
    createdAt: toDate(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// ConsumptionDataPoint
// ---------------------------------------------------------------------------

export function fromDbConsumptionData(row: DbConsumptionData): ConsumptionDataPoint {
  return {
    id: row.id,
    homePropertyId: row.home_property_id,
    granularity: row.granularity,
    periodStart: toDate(row.period_start),
    periodEnd: toDate(row.period_end),
    kwh: row.kwh,
    source: nullToUndef(row.source),
    createdAt: toDate(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// HomeProfile
// ---------------------------------------------------------------------------

export function fromDbHomeProfile(row: DbHomeProfile): HomeProfile {
  return {
    homePropertyId: row.home_property_id,
    livingAreaM2: nullToUndef(row.living_area_m2),
    buildingYear: nullToUndef(row.building_year),
    buildingType: nullToUndef(row.building_type),
    heatingType: nullToUndef(row.heating_type),
    numResidents: nullToUndef(row.num_residents),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// HomeEquipment (typad mot equipment_key)
// ---------------------------------------------------------------------------

/**
 * Konvertera en databasrad till typad HomeEquipment.
 * Använder isEquipmentKey type guard för att smalna typen.
 *
 * Returnerar null om equipment_key inte är en känd nyckel — det betyder att
 * databasen har en rad med en nyckel som inte är definierad i 
 * EquipmentKey-unionen. Caller kan logga och hoppa över.
 */
export function fromDbHomeEquipment(
  row: DbHomeEquipment,
): HomeEquipment | null {
  if (!isEquipmentKey(row.equipment_key)) {
    return null;
  }

  // Type assertion: vi har verifierat via guard att equipment_key är en 
  // EquipmentKey, men TS kan inte härleda att equipment_data matchar 
  // EquipmentDataMap[key] eftersom det är jsonb. Caller ansvarar för 
  // att data är välformat.
  const key = row.equipment_key as EquipmentKey;
  return {
    homePropertyId: row.home_property_id,
    equipmentKey: key,
    equipmentData: row.equipment_data as EquipmentDataMap[typeof key],
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}
