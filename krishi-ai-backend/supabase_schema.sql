"""
Supabase Database Schema SQL
Run this in your Supabase SQL Editor to create all necessary tables
"""

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'farmer',
    location VARCHAR(255),
    my_crops TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Progress table (Gamification)
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    rank VARCHAR(50) DEFAULT 'Beginner',
    scans_count INTEGER DEFAULT 0,
    achievements TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Analysis Reports table
CREATE TABLE IF NOT EXISTS analysis_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    diagnosis TEXT,
    category VARCHAR(50),
    confidence INTEGER,
    advisory TEXT,
    full_report TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Saved Reports table
CREATE TABLE IF NOT EXISTS saved_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    icon VARCHAR(10) DEFAULT '📄',
    audio_base64 TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Crops table
CREATE TABLE IF NOT EXISTS user_crops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    planted_date VARCHAR(50),
    expected_harvest VARCHAR(50),
    area DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market Prices table
CREATE TABLE IF NOT EXISTS market_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    retail DECIMAL[] NOT NULL,
    wholesale DECIMAL[] NOT NULL,
    unit VARCHAR(20) NOT NULL,
    trend VARCHAR(10),
    change VARCHAR(20),
    location VARCHAR(100) DEFAULT 'ঢাকা',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weather Cache table
CREATE TABLE IF NOT EXISTS weather_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location VARCHAR(100) UNIQUE NOT NULL,
    data JSONB NOT NULL,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_user_id ON analysis_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_user_id ON saved_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_user_crops_user_id ON user_crops(user_id);
CREATE INDEX IF NOT EXISTS idx_market_prices_location ON market_prices(location);
CREATE INDEX IF NOT EXISTS idx_weather_cache_location ON weather_cache(location);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_crops_updated_at BEFORE UPDATE ON user_crops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample market data
INSERT INTO market_prices (name, category, retail, wholesale, unit, trend, change, location) VALUES
('ধান (মোটা)', 'শস্য', ARRAY[32, 34], ARRAY[30, 32], 'কেজি', 'up', '+৳২', 'ঢাকা'),
('আলু', 'সবজি', ARRAY[35, 40], ARRAY[30, 35], 'কেজি', 'down', '-৳৫', 'ঢাকা'),
('পেঁয়াজ', 'সবজি', ARRAY[60, 70], ARRAY[55, 65], 'কেজি', 'up', '+৳১০', 'ঢাকা'),
('টমেটো', 'সবজি', ARRAY[80, 90], ARRAY[70, 80], 'কেজি', 'stable', '০', 'ঢাকা'),
('ইউরিয়া সার', 'সার', ARRAY[22, 24], ARRAY[20, 22], 'কেজি', 'stable', '০', 'ঢাকা')
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_crops ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (users can only access their own data)
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own progress" ON user_progress
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own reports" ON analysis_reports
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own saved reports" ON saved_reports
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own crops" ON user_crops
    FOR ALL USING (auth.uid() = user_id);

-- Market prices and weather cache are public read
CREATE POLICY "Anyone can view market prices" ON market_prices
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view weather cache" ON weather_cache
    FOR SELECT USING (true);
