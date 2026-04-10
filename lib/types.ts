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
  | "amenity";

export type RatePeriod = "month" | "day" | "biweekly" | "hour";

export interface Building {
  id: number;
  name: string;
  address: string;
  building_class: string;
  total_area: number;
  leasable_area: number;
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
}

export interface Tenant {
  id: number;
  user_id: number;
  company_name: string;
  contact_name: string | null;
  plan_type: string | null;
  monthly_rate: number;
  coin_balance: number;
  coin_last_reset: string | null;
  is_resident: boolean;
}

export interface AvailabilitySlot {
  time: string; // "HH:MM"
  available: boolean;
}

export type BillingMode = "per_unit" | "per_seat";

export interface Plan {
  id: number;
  building_id: number;
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
