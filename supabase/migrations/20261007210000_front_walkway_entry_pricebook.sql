-- Keep the public offer and RinsePoint OS Pricebook aligned.
-- Reuses the existing generic walkway service rather than creating a duplicate.
update public.services
set name = 'Front Walkway & Entry Cleaning',
    description = 'Front walkway, entry path, and small front stoop/landing cleaning. Larger areas or extra surfaces are quoted as needed.',
    pricing_model = 'fixed',
    base_price = 99.00,
    unit_price = null,
    taxable = true,
    active = true
where organization_id = '00000000-0000-4000-8000-000000000001'
  and name in ('Sidewalk / walkway cleaning', 'Front Walkway & Entry Cleaning');
