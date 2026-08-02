-- 🚀 ProLink Professional Seeding SQL
-- Generates 1000 jobs and 1000 posts directly in PostgreSQL

-- 1. Cleaning old test data
DELETE FROM jobs WHERE company LIKE '%(Seed)%';
DELETE FROM posts WHERE content LIKE '%#ProLink_Seed%';

-- 2. Bulk Inserting Jobs
INSERT INTO jobs (title, company, description, location, salary, job_type, is_active, created_at)
SELECT 
    (ARRAY['Software Engineer', 'Frontend Dev', 'Backend Dev', 'UI/UX Designer', 'DevOps', 'Data Analyst'])[floor(random() * 6 + 1)] as title,
    'Company ' || i || ' (Seed)' as company,
    'Professional job description for seed item ' || i as description,
    (ARRAY['Baghdad', 'Basra', 'Erbil', 'Mosul', 'Najaf'])[floor(random() * 5 + 1)] as location,
    (random() * 2000 + 500)::int || '$' as salary,
    (ARRAY['Full-time', 'Part-time', 'Remote', 'Hybrid'])[floor(random() * 4 + 1)] as job_type,
    true as is_active,
    now() - (random() * interval '30 days') as created_at
FROM generate_series(1, 1000) s(i);

-- 3. Bulk Inserting Posts
INSERT INTO posts (content, author_name, likes_count, created_at)
SELECT 
    'Professional post content for the social feed. This is item #' || i || ' #ProLink_Seed #Professional' as content,
    (ARRAY['Ahmed', 'Sara', 'Mohammed', 'Fatima', 'Ali', 'Zainab'])[floor(random() * 6 + 1)] as author_name,
    floor(random() * 500)::int as likes_count,
    now() - (random() * interval '30 days') as created_at
FROM generate_series(1, 1000) s(i);

COMMIT;
