-- Migration: Add payment and delivery methods to vendors
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS delivery_options JSONB DEFAULT '[]'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN vendors.payment_methods IS 'List of payment options: [{type: string, details: string}]';
COMMENT ON COLUMN vendors.delivery_options IS 'List of delivery/recovery options: [{type: string, details: string}]';
