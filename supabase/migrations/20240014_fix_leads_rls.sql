-- Force allow public insert on leads and appliances_input to fix 403 error
DROP POLICY IF EXISTS "leads_public_insert" ON leads;
CREATE POLICY "leads_public_insert"
    ON leads
    FOR INSERT
    TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "appliances_input_public_insert" ON appliances_input;
CREATE POLICY "appliances_input_public_insert"
    ON appliances_input
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE appliances_input ENABLE ROW LEVEL SECURITY;
