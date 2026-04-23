// Shared types — mirror FastAPI response shapes from cbc-coworking-api.

export type UserRole = "admin" | "manager" | "tenant" | "owner";

export type UnitStatus = "vacant" | "occupied" | "reserved";

// Kept for legacy compatibility — current code should use ResourceType.
export type UnitType = "office" | "meeting_room" | "hot_desk" | "open_space";

export type ResourceType =
  | "office"
  | "meeting_room"
  | "hot_desk"
  | "open_space"
  | "amenity"
  | "event_zone"
  | "zoom_cabin";

export type RatePeriod = "month" | "day" | "biweekly" | "hour";

export type PropertyType = "office" | "retail" | "warehouse" | "industrial" | "mixed_use" | "residential";
export type PropertyClass = "A+" | "A" | "B+" | "B" | "C";

export interface Building {
  id: number;
  name: string;
  address: string;
  building_class: string;
  total_area: number;
  leasable_area: number;

  property_type?: PropertyType | null;
  property_class?: PropertyClass | null;
  city?: string | null;
  gba_m2?: number | null;
  gla_m2?: number | null;
  rentable_area_m2?: number | null;
  floors_count?: number | null;
  year_built?: number | null;
  parking_spaces?: number | null;
  owner_name?: string | null;
  management_start_date?: string | null;
  description?: string | null;
  photo_url?: string | null;
  facade_image_url?: string | null;
  is_active?: boolean;
  created_at?: string | null;
}

export interface FloorSummary {
  id: number;
  name: string | null;
  number: number;
  vacancy_metric: string;
  total_area_m2: number | null;
  total_seats: number | null;
  total_resources: number;
  occupied_resources: number;
  vacant_resources: number;
  vacancy_rate: number | null;
}

export interface PropertyTotals {
  total_floors: number;
  total_resources: number;
  occupied_resources: number;
  vacant_resources: number;
  gla_m2: number | null;
  occupied_m2: number;
  vacancy_rate_m2: number | null;
  total_tenants: number;
}

export interface PropertySummary {
  property: Building;
  floors: FloorSummary[];
  totals: PropertyTotals;
}

export interface Floor {
  id: number;
  building_id: number;
  number: number;
  name: string | null;
  floor_plan_url: string | null;
}

export interface Point {
  x: number;
  y: number;
}

export interface Resource {
  id: number;
  building_id: number;
  floor_id: number | null;
  name: string;
  resource_type: ResourceType;
  status: UnitStatus;
  description: string | null;
  photos: string[] | null;
  tenant_id: number | null;
  tenant_name: string | null;

  // office / hot_desk / open_space
  area_m2: number | null;
  seats: number | null;
  monthly_rate: number | null;
  rate_period: RatePeriod | null;

  // meeting_room
  capacity: number | null;
  rate_coins_per_hour: number | null;
  rate_money_per_hour: number | null;
  amenities: string[] | null;

  // amenity
  rate_per_hour: number | null;
  is_standalone_bookable: boolean;

  // plan linkage
  plan_id: number | null;
  plan?: Plan | null;
  effective_monthly_rate?: number | null;

  // booking policy
  min_advance_minutes: number;
  resident_discount_pct: number;

  zoho_contract_id: string | null;
  created_at?: string | null;
}

export interface Zone {
  id: number;
  floor_id: number;
  resource_id: number | null;
  points: Point[];
  label: string | null;
  /** Joined server-side from the linked resource for canvas rendering. */
  resource_type?: ResourceType | null;
  status?: UnitStatus | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  name: string;
  permissions: string[];
}

export interface TenantUnitSummary {
  resource_id: number;
  name: string;
  type: string;
  monthly_rate: number;
  plan_name: string | null;
  coin_pct: number;
  coin_allowance: number;
  floor_name?: string | null;
}

export interface Tenant {
  id: number;
  user_id: number;
  tenant_type: string;
  company_name: string;
  contact_name: string | null;
  // Plan binding (Sprint 1.5)
  plan_id: number | null;
  // Plan name resolved server-side from tenant.plan; null if no plan bound
  plan_type: string | null;
  // Computed from assigned resources (read-only)
  total_monthly_rate: number;
  monthly_coin_allowance: number;
  monthly_rate: number; // alias of total_monthly_rate for back-compat
  // Mutable
  coin_balance: number;
  cash_balance: number;
  coin_last_reset: string | null;
  contact_phone?: string | null;
  is_resident: boolean;
  unit_number: string | null;
  notes: string | null;
  units?: TenantUnitSummary[];
  unit_count?: number;
}


export interface AvailabilitySlot {
  time: string; // "HH:MM"
  available: boolean;
}

export type BillingMode = "per_unit" | "per_seat";

export interface Plan {
  id: number;
  building_id: number;
  /** Server-populated convenience field (Sprint 1.5). Not present on
   *  client-side templates for new plans before they hit the server. */
  building_name?: string | null;
  name: string;
  billing_mode: BillingMode;
  base_rate_uzs: number;
  coin_pct: number;
  coin_reset_day: number;
  meeting_discount_pct: number;
  meeting_discount_on: boolean;
  event_discount_pct: number;
  event_discount_on: boolean;
  is_active: boolean;
  created_at?: string;
}

export type BookingPaymentType = "coins" | "money";

export interface Booking {
  id: number;
  resource_id: number | null;
  tenant_id: number;
  start_time: string; // ISO
  end_time: string; // ISO
  payment_type: BookingPaymentType;
  coins_charged: number;
  money_charged: number;
  money_charged_uzs: number;
}
