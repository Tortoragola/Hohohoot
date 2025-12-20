-- Supabase Auth Integration - SQL Commands
-- Run these in Supabase SQL Editor

-- NOTE: Quiz visibility logic has changed:
-- Public Quiz: user_id = NULL (shared with everyone, no owner)
-- Private Quiz: user_id = <user_id> (only owner can see/use)

-- 1. Update RLS policies (if not already set)

-- Policy: Update own quizzes (only private quizzes)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'quizzes' 
        AND policyname = 'Users can update own quizzes'
    ) THEN
        CREATE POLICY "Users can update own quizzes" 
        ON quizzes FOR UPDATE 
        USING (auth.uid() = user_id AND user_id IS NOT NULL);
    END IF;
END $$;

-- Policy: Delete own quizzes (only private quizzes)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'quizzes' 
        AND policyname = 'Users can delete own quizzes'
    ) THEN
        CREATE POLICY "Users can delete own quizzes" 
        ON quizzes FOR DELETE 
        USING (auth.uid() = user_id AND user_id IS NOT NULL);
    END IF;
END $$;

-- Policy: Anyone can insert quizzes (for public quizzes with NULL user_id)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'quizzes' 
        AND policyname = 'Anyone can create quizzes'
    ) THEN
        CREATE POLICY "Anyone can create quizzes" 
        ON quizzes FOR INSERT 
        WITH CHECK (true);
    END IF;
END $$;

-- 2. Add index for better performance on user queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id_created 
ON quizzes(user_id, created_at DESC);

-- 3. Optional: Add function to get user quiz count
CREATE OR REPLACE FUNCTION get_user_quiz_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM quizzes WHERE user_id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Verify policies are working
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'quizzes'
ORDER BY policyname;

-- Expected output should show:
-- ✅ Quizzes are viewable by everyone (SELECT)
-- ✅ Users can create own quizzes (INSERT)
-- ✅ Users can update own quizzes (UPDATE)
-- ✅ Users can delete own quizzes (DELETE)
