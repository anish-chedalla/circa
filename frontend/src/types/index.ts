/**
 * Shared TypeScript interfaces for the FBLA Local Business Discovery App.
 * All field names match the snake_case keys returned by the FastAPI backend.
 */

/** Represents a local business listing. */
export interface Business {
  id: number;
  name: string;
  category: string;
  address: string | null;
  city: string;
  state?: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  google_place_id?: string | null;
  google_photo_url?: string | null;
  google_summary?: string | null;
  google_last_synced_at?: string | null;
  hours: Record<string, string> | null;
  is_chain: boolean;
  avg_rating: number;
  review_count: number;
  claimed: boolean;
  owner_id: number | null;
  has_active_deals?: boolean;
  score?: number;
  created_at?: string;
  updated_at?: string;
}

/** Represents a business detail response with nested reviews and deals. */
export interface BusinessDetail extends Business {
  reviews: ReviewItem[];
  deals: DealItem[];
}

/** Review as returned inside a business detail response. */
export interface ReviewItem {
  id: number;
  rating: number;
  text: string | null;
  created_at: string | null;
  user: {
    id: number;
    email: string;
    display_name?: string | null;
    profile_image_url?: string | null;
  } | null;
}

/** Deal as returned inside a business detail response. */
export interface DealItem {
  id: number;
  title: string;
  description: string | null;
  expiry_date: string | null;
  is_active: boolean;
}

/** Represents a user review for a business. */
export interface Review {
  id: number;
  business_id: number;
  user_id: number;
  rating: number;
  text: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    email: string;
    display_name?: string | null;
    profile_image_url?: string | null;
  };
}

/** Represents a promotional deal offered by a business. */
export interface Deal {
  id: number;
  business_id: number;
  title: string;
  description: string | null;
  expiry_date: string | null;
  is_active: boolean;
  created_at: string;
}

/** Represents an application user. */
export interface User {
  id: number;
  email: string;
  display_name?: string | null;
  profile_image_url?: string | null;
  role: string;
}

/** Represents a user's favorited business. */
export interface Favorite {
  id: number;
  user_id: number;
  business_id: number;
  created_at: string;
  business?: Business;
}

/** Represents a request by a user to claim ownership of a business listing. */
export interface BusinessClaim {
  id: number;
  business_id: number;
  user_id: number;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at: string | null;
  reviewer_id: number | null;
  business?: Business;
  user?: User;
}

/** Generic API response wrapper. */
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

/** Filter state for the Map Discovery page. */
export interface BusinessFilters {
  category: string;
  city: string;
  minRating: number;
  hasDeals: boolean;
  sortBy: string;
  search: string;
}
