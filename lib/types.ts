// Shared types — mirror FastAPI response shapes from cbc-coworking-api.

export type UserRole = "admin" | "manager" | "tenant" | "owner";

export type UnitStatus = "vacant" | "occupied" | "reserved";

export type UnitType = "office" | "meeting_room" | "hot_desk" | "open_space";

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

export interface Zone {
  id: number;
  floor_id: number;
  unit_id: number | null;
  points: Point[];
  label: string | null;
  zone_type: UnitType;
  /** Joined client-side from the linked unit */
  status?: UnitStatus;
}

export type RatePeriod = "month" | "day" | "biweekly" | "hour";

export interface Unit {
  id: number;
  floor_id: number;
  name: string;
  unit_type: UnitType;
  status: UnitStatus;
  area_m2: number;
  seats: number;
  monthly_rate: number;
  rate_period: RatePeriod | null;
  tenant_name: string | null;
  description: string | null;
  photos: string[] | null;
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
  is_resident: boolean;
}

export interface MeetingRoomUnitMini {
  id: number;
  name: string;
  floor_id: number;
}

export interface MeetingRoom {
  id: number;
  unit_id: number;
  name: string;
  capacity: number;
  rate_coins_per_hour: number;
  rate_money_per_hour: number;
  amenities: string[] | null;
  is_active: boolean;
  unit: MeetingRoomUnitMini | null;
}

export interface AvailabilitySlot {
  time: string; // "HH:MM"
  available: boolean;
}

export type BookingPaymentType = "coins" | "money";

export interface Booking {
  id: number;
  room_id: number;
  tenant_id: number;
  start_time: string; // ISO
  end_time: string; // ISO
  payment_type: BookingPaymentType;
  coins_charged: number;
  money_charged: number;
}
