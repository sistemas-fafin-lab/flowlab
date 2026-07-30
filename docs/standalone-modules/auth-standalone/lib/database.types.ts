export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name: string
          code: string
          category: 'general' | 'technical'
          quantity: number
          unit: string
          supplier: string
          batch: string
          entry_date: string
          expiration_date: string
          location: string
          min_stock: number
          status: 'active' | 'low-stock' | 'expired'
          unit_price: number | null
          invoicenumber: string | null
          iswithholding: boolean | null
          supplier_id: string | null
          supplier_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          category: 'general' | 'technical'
          quantity?: number
          unit: string
          supplier: string
          batch: string
          entry_date: string
          expiration_date: string
          location: string
          min_stock?: number
          status?: 'active' | 'low-stock' | 'expired'
          unit_price?: number | null
          invoicenumber?: string | null
          iswithholding?: boolean | null
          supplier_id?: string | null
          supplier_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          category?: 'general' | 'technical'
          quantity?: number
          unit?: string
          supplier?: string
          batch?: string
          entry_date?: string
          expiration_date?: string
          location?: string
          min_stock?: number
          status?: 'active' | 'low-stock' | 'expired'
          unit_price?: number | null
          invoicenumber?: string | null
          iswithholding?: boolean | null
          supplier_id?: string | null
          supplier_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      stock_movements: {
        Row: {
          id: string
          product_id: string
          product_name: string
          type: 'out'
          reason: 'sale' | 'internal-transfer' | 'return' | 'internal-consumption' | 'other'
          quantity: number
          date: string
          request_id: string | null
          authorized_by: string | null
          notes: string | null
          unit_price: number | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          product_name: string
          type?: 'out'
          reason: 'sale' | 'internal-transfer' | 'return' | 'internal-consumption' | 'other'
          quantity: number
          date?: string
          request_id?: string | null
          authorized_by?: string | null
          notes?: string | null
          unit_price?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          product_name?: string
          type?: 'out'
          reason?: 'sale' | 'internal-transfer' | 'return' | 'internal-consumption' | 'other'
          quantity?: number
          date?: string
          request_id?: string | null
          authorized_by?: string | null
          notes?: string | null
          unit_price?: number | null
          created_at?: string
        }
      }
      requests: {
        Row: {
          id: string
          type: 'SC' | 'SM'
          items: Json[]
          reason: string
          requested_by: string
          request_date: string
          status: 'pending' | 'approved' | 'rejected' | 'completed'
          priority: 'low' | 'standard' | 'priority' | 'urgent'
          approved_by: string | null
          approval_date: string | null
          notes: string | null
          department: string | null
          supplier_id: string | null
          supplier_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type?: 'SC' | 'SM'
          items: Json[]
          reason: string
          requested_by: string
          request_date?: string
          status?: 'pending' | 'approved' | 'rejected' | 'completed'
          priority?: 'low' | 'standard' | 'priority' | 'urgent'
          approved_by?: string | null
          approval_date?: string | null
          notes?: string | null
          department?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: 'SC' | 'SM'
          items?: Json[]
          reason?: string
          requested_by?: string
          request_date?: string
          status?: 'pending' | 'approved' | 'rejected' | 'completed'
          priority?: 'low' | 'standard' | 'priority' | 'urgent'
          approved_by?: string | null
          approval_date?: string | null
          notes?: string | null
          department?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          name: string
          cnpj: string
          email: string
          phone: string
          address: string
          contact_person: string
          products: string[]
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          cnpj: string
          email: string
          phone: string
          address: string
          contact_person: string
          products: string[]
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          cnpj?: string
          email?: string
          phone?: string
          address?: string
          contact_person?: string
          products?: string[]
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
      }
      quotations: {
        Row: {
          id: string
          request_id: string
          product_id: string
          product_name: string
          requested_quantity: number
          status: 'draft' | 'sent' | 'completed' | 'cancelled'
          selected_supplier_id: string | null
          selected_price: number | null
          selected_delivery_time: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          request_id: string
          product_id: string
          product_name: string
          requested_quantity: number
          status?: 'draft' | 'sent' | 'completed' | 'cancelled'
          selected_supplier_id?: string | null
          selected_price?: number | null
          selected_delivery_time?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          product_id?: string
          product_name?: string
          requested_quantity?: number
          status?: 'draft' | 'sent' | 'completed' | 'cancelled'
          selected_supplier_id?: string | null
          selected_price?: number | null
          selected_delivery_time?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      quotation_items: {
        Row: {
          id: string
          quotation_id: string
          supplier_id: string
          supplier_name: string
          unit_price: number | null
          total_price: number | null
          delivery_time: string | null
          notes: string | null
          status: 'draft' | 'submitted' | 'selected' | 'rejected'
          submitted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          quotation_id: string
          supplier_id: string
          supplier_name: string
          unit_price?: number | null
          total_price?: number | null
          delivery_time?: string | null
          notes?: string | null
          status?: 'draft' | 'submitted' | 'selected' | 'rejected'
          submitted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          quotation_id?: string
          supplier_id?: string
          supplier_name?: string
          unit_price?: number | null
          total_price?: number | null
          delivery_time?: string | null
          notes?: string | null
          status?: 'draft' | 'submitted' | 'selected' | 'rejected'
          submitted_at?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}