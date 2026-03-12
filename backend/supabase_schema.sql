-- Step 1: Create Supabase tables
-- Run this in the Supabase SQL Editor

-- Table: content_briefs
CREATE TABLE content_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID, -- Assuming you might have a clients table, or it can be a string
    title TEXT NOT NULL,
    target_keyword TEXT NOT NULL,
    secondary_keywords TEXT[],
    outline TEXT,
    angle TEXT,
    status TEXT CHECK (status IN ('PENDING', 'IN_PROGRESS', 'PUBLISHED', 'SKIPPED')) DEFAULT 'PENDING',
    word_count_target INTEGER,
    trend_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Table: content_calendar
CREATE TABLE content_calendar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brief_id UUID REFERENCES content_briefs(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    priority TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Table: content (Published blog posts)
CREATE TABLE content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brief_id UUID REFERENCES content_briefs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    html_content TEXT NOT NULL,
    seo_score INTEGER,
    live_url TEXT,
    featured_image_url TEXT,
    status TEXT DEFAULT 'PUBLISHED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Table: post_performance (SEO performance metrics)
CREATE TABLE post_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES content(id) ON DELETE CASCADE,
    avg_position NUMERIC,
    clicks INTEGER,
    ctr NUMERIC,
    impressions INTEGER,
    score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Disable Row Level Security (RLS) so the API can insert data
ALTER TABLE content_briefs DISABLE ROW LEVEL SECURITY;
ALTER TABLE content_calendar DISABLE ROW LEVEL SECURITY;
ALTER TABLE content DISABLE ROW LEVEL SECURITY;
ALTER TABLE post_performance DISABLE ROW LEVEL SECURITY;
