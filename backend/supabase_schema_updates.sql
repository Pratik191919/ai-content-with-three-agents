-- 1. Add new columns to existing 'content' table for Multi-Language Support and Tracking
ALTER TABLE public.content 
ADD COLUMN IF NOT EXISTS html_content_hi TEXT,
ADD COLUMN IF NOT EXISTS html_content_gu TEXT,
ADD COLUMN IF NOT EXISTS social_posted BOOLEAN DEFAULT FALSE;

-- 2. Create table for Social Media Posts (Social Agent)
CREATE TABLE IF NOT EXISTS public.social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES public.content(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- e.g., 'LinkedIn', 'Twitter'
    post_text TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, POSTED, FAILED
    posted_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create table for Repurposed Content (Repurposing Agent)
CREATE TABLE IF NOT EXISTS public.repurposed_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES public.content(id) ON DELETE CASCADE,
    format_type VARCHAR(50) NOT NULL, -- e.g., 'Twitter_Thread', 'LinkedIn_Carousel', 'YouTube_Short_Script'
    content_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create table for Agent Queue DLQ (Dead Letter Queue) - Optional but good for Admin Dashboard
CREATE TABLE IF NOT EXISTS public.agent_failed_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name VARCHAR(100),
    brief_id UUID,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Add Fact-Checking and Analytics columns to 'content' table
ALTER TABLE public.content 
ADD COLUMN IF NOT EXISTS fact_check_status VARCHAR(50) DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS fact_check_notes TEXT,
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0;

-- 6. Create Trending Topics table (Trend Agent)
CREATE TABLE IF NOT EXISTS public.trending_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword VARCHAR(255) NOT NULL,
    search_volume INTEGER DEFAULT 0,
    source VARCHAR(50) DEFAULT 'Google Trends',
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create Newsletters table (Newsletter Agent)
CREATE TABLE IF NOT EXISTS public.newsletters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_line VARCHAR(255) NOT NULL,
    html_body TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT',
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
