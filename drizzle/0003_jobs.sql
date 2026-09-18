CREATE TABLE morice_jobs (
 id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, title TEXT NOT NULL, request TEXT NOT NULL,
 operation TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', response_id TEXT NOT NULL DEFAULT '',
 result TEXT NOT NULL DEFAULT '', evidence TEXT NOT NULL DEFAULT '{}', error TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_morice_jobs_user ON morice_jobs(user_id, created_at);
CREATE TABLE morice_job_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, user_id TEXT NOT NULL,
 status TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX idx_morice_job_events ON morice_job_events(user_id, job_id, id);
