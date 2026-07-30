-- ═══════════════════════════════════════════════════════════════════════════════
-- ITSM Upgrade: Tags System for IT Requests
-- ═══════════════════════════════════════════════════════════════════════════════
-- This migration adds tags support to the it_requests table for better
-- categorization and filtering of IT tasks in the Kanban board.

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ADD TAGS COLUMN
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Add tags column as a text array (supports multiple tags per task)
ALTER TABLE public.it_requests
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.it_requests.tags IS 'Array of tags for categorizing IT tasks (e.g., urgente, bug, feature)';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- CREATE INDEX FOR FASTER TAG QUERIES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- GIN index for efficient array containment queries (e.g., WHERE 'bug' = ANY(tags))
CREATE INDEX IF NOT EXISTS idx_it_requests_tags ON public.it_requests USING GIN (tags);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- HELPER FUNCTION: Get all unique tags
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Function to get all unique tags used across all IT requests
CREATE OR REPLACE FUNCTION get_it_request_tags()
RETURNS TABLE (tag TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT unnest(ir.tags) as tag, COUNT(*) as count
  FROM public.it_requests ir
  WHERE ir.status != 'cancelled' AND ir.tags IS NOT NULL AND array_length(ir.tags, 1) > 0
  GROUP BY tag
  ORDER BY count DESC, tag ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_it_request_tags() TO authenticated;
