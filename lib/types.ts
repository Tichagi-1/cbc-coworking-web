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

export interface Unit {
  id: number;
  floor_id: number;
  name: string;
  unit_type: UnitType;
  status: UnitStatus;
  area_m2: number;
  seats: number;
  monthly_rate: number;
  description: string | null;
  photos: string[] | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  name: string;
}
