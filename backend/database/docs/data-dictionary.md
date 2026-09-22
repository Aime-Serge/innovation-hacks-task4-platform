# Data dictionary

Generated from the live schema by `scripts/generate_db_docs.py`. Do not edit by hand:
`make db-docs` rewrites it and `make db-docs-check` fails when it is out of date.

## `users`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | `gen_random_uuid()` |
| `name` | text | no |  |
| `email` | text | no |  |
| `password_hash` | text | no |  |
| `role` | text | no | `'developer'::text` |
| `avatar_url` | text | yes |  |
| `theme` | text | no | `'system'::text` |
| `created_at` | timestamptz | no | `now()` |
| `updated_at` | timestamptz | no | `now()` |
| `given_name` | text | yes |  |
| `family_name` | text | yes |  |

| Constraint | Kind | Definition |
| --- | --- | --- |
| `ck_users_avatar_url` | check | `CHECK (((avatar_url IS NULL) OR ((avatar_url ~~ 'https://%'::text) AND (char_length(avatar_url) <= 2048))))` |
| `ck_users_email_format` | check | `CHECK (((email = lower(email)) AND (char_length(email) <= 254) AND (POSITION(('@'::text) IN (email)) > 0)))` |
| `ck_users_family_name_length` | check | `CHECK (((family_name IS NULL) OR (((char_length(family_name) >= 1) AND (char_length(family_name) <= 60)) AND (family_name = btrim(family_name)))))` |
| `ck_users_given_name_length` | check | `CHECK (((given_name IS NULL) OR (((char_length(given_name) >= 1) AND (char_length(given_name) <= 60)) AND (given_name = btrim(given_name)))))` |
| `ck_users_name_length` | check | `CHECK ((((char_length(name) >= 1) AND (char_length(name) <= 80)) AND (name = btrim(name))))` |
| `ck_users_password_hash_present` | check | `CHECK ((char_length(password_hash) > 0))` |
| `ck_users_role` | check | `CHECK ((role = ANY (ARRAY['developer'::text, 'lead'::text])))` |
| `ck_users_theme` | check | `CHECK ((theme = ANY (ARRAY['light'::text, 'dark'::text, 'system'::text])))` |
| `pk_users` | primary key | `PRIMARY KEY (id)` |
| `uq_users_email` | unique | `UNIQUE (email)` |

| Index | Definition |
| --- | --- |
| `ix_users_role` | `CREATE INDEX ix_users_role ON public.users USING btree (role)` |
| `uq_users_email` | `CREATE UNIQUE INDEX uq_users_email ON public.users USING btree (email)` |

## `projects`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | `gen_random_uuid()` |
| `name` | text | no |  |
| `description` | text | no | `''::text` |
| `status` | text | no | `'planned'::text` |
| `due_date` | date | yes |  |
| `owner_id` | uuid | no |  |
| `created_at` | timestamptz | no | `now()` |
| `updated_at` | timestamptz | no | `now()` |

| Constraint | Kind | Definition |
| --- | --- | --- |
| `ck_projects_description_length` | check | `CHECK ((char_length(description) <= 2000))` |
| `ck_projects_name_length` | check | `CHECK ((((char_length(name) >= 1) AND (char_length(name) <= 80)) AND (name = btrim(name))))` |
| `ck_projects_status` | check | `CHECK ((status = ANY (ARRAY['planned'::text, 'active'::text, 'on_hold'::text, 'completed'::text])))` |
| `fk_projects_owner_id_users` | foreign key | `FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT` (on delete restrict) |
| `pk_projects` | primary key | `PRIMARY KEY (id)` |

| Index | Definition |
| --- | --- |
| `ix_projects_name_trgm` | `CREATE INDEX ix_projects_name_trgm ON public.projects USING gin (name gin_trgm_ops)` |
| `ix_projects_owner_id` | `CREATE INDEX ix_projects_owner_id ON public.projects USING btree (owner_id)` |
| `ix_projects_status` | `CREATE INDEX ix_projects_status ON public.projects USING btree (status)` |

## `tasks`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | `gen_random_uuid()` |
| `project_id` | uuid | no |  |
| `title` | text | no |  |
| `description` | text | no | `''::text` |
| `status` | text | no | `'todo'::text` |
| `priority` | text | no | `'medium'::text` |
| `priority_rank` | smallint | no | generated: `
CASE priority
    WHEN 'urgent'::text THEN 4
    WHEN 'high'::text THEN 3
    WHEN 'medium'::text THEN 2
    ELSE 1
END` |
| `due_date` | date | yes |  |
| `assignee_id` | uuid | yes |  |
| `completed_at` | timestamptz | yes |  |
| `created_at` | timestamptz | no | `now()` |
| `updated_at` | timestamptz | no | `now()` |

| Constraint | Kind | Definition |
| --- | --- | --- |
| `ck_tasks_completed_consistency` | check | `CHECK (((status = 'done'::text) = (completed_at IS NOT NULL)))` |
| `ck_tasks_description_length` | check | `CHECK ((char_length(description) <= 4000))` |
| `ck_tasks_priority` | check | `CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])))` |
| `ck_tasks_status` | check | `CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'in_review'::text, 'done'::text])))` |
| `ck_tasks_title_length` | check | `CHECK ((((char_length(title) >= 1) AND (char_length(title) <= 120)) AND (title = btrim(title))))` |
| `fk_tasks_assignee_id_users` | foreign key | `FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL` (on delete set null) |
| `fk_tasks_project_id_projects` | foreign key | `FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT` (on delete restrict) |
| `pk_tasks` | primary key | `PRIMARY KEY (id)` |

| Index | Definition |
| --- | --- |
| `ix_tasks_assignee_id_project_id` | `CREATE INDEX ix_tasks_assignee_id_project_id ON public.tasks USING btree (assignee_id, project_id) WHERE (assignee_id IS NOT NULL)` |
| `ix_tasks_assignee_id_status` | `CREATE INDEX ix_tasks_assignee_id_status ON public.tasks USING btree (assignee_id, status) WHERE (assignee_id IS NOT NULL)` |
| `ix_tasks_created_at_id` | `CREATE INDEX ix_tasks_created_at_id ON public.tasks USING btree (created_at, id)` |
| `ix_tasks_description_trgm` | `CREATE INDEX ix_tasks_description_trgm ON public.tasks USING gin (description gin_trgm_ops)` |
| `ix_tasks_due_date_id` | `CREATE INDEX ix_tasks_due_date_id ON public.tasks USING btree (due_date, id)` |
| `ix_tasks_due_date_open` | `CREATE INDEX ix_tasks_due_date_open ON public.tasks USING btree (due_date) WHERE (status <> 'done'::text)` |
| `ix_tasks_priority_rank_id` | `CREATE INDEX ix_tasks_priority_rank_id ON public.tasks USING btree (priority_rank DESC, id)` |
| `ix_tasks_project_id_status` | `CREATE INDEX ix_tasks_project_id_status ON public.tasks USING btree (project_id, status)` |
| `ix_tasks_title_trgm` | `CREATE INDEX ix_tasks_title_trgm ON public.tasks USING gin (title gin_trgm_ops)` |

## `activity`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | `gen_random_uuid()` |
| `actor_id` | uuid | no |  |
| `project_id` | uuid | no |  |
| `task_id` | uuid | yes |  |
| `type` | text | no |  |
| `at` | timestamptz | no | `now()` |

| Constraint | Kind | Definition |
| --- | --- | --- |
| `ck_activity_type` | check | `CHECK ((type = ANY (ARRAY['created'::text, 'status_changed'::text, 'completed'::text])))` |
| `fk_activity_actor_id_users` | foreign key | `FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE` (on delete cascade) |
| `fk_activity_project_id_projects` | foreign key | `FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE` (on delete cascade) |
| `fk_activity_task_id_tasks` | foreign key | `FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL` (on delete set null) |
| `pk_activity` | primary key | `PRIMARY KEY (id)` |

| Index | Definition |
| --- | --- |
| `ix_activity_actor_id` | `CREATE INDEX ix_activity_actor_id ON public.activity USING btree (actor_id)` |
| `ix_activity_at_id` | `CREATE INDEX ix_activity_at_id ON public.activity USING btree (at DESC, id DESC)` |
| `ix_activity_project_id` | `CREATE INDEX ix_activity_project_id ON public.activity USING btree (project_id)` |
| `ix_activity_task_id` | `CREATE INDEX ix_activity_task_id ON public.activity USING btree (task_id)` |

## `profiles`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `user_id` | uuid | no |  |
| `discipline` | text | no |  |
| `seniority` | text | no |  |
| `employment_status` | text | no |  |
| `company_name` | text | yes |  |
| `job_title` | text | yes |  |
| `country_code` | text | no |  |
| `city` | text | yes |  |
| `time_zone` | text | no |  |
| `headline` | text | yes |  |
| `about` | text | no | `''::text` |
| `github_url` | text | yes |  |
| `linkedin_url` | text | yes |  |
| `website_url` | text | yes |  |
| `show_professional_details` | boolean | no | `true` |
| `terms_version` | text | no |  |
| `terms_accepted_at` | timestamptz | no |  |
| `age_confirmed_at` | timestamptz | yes |  |
| `created_at` | timestamptz | no | `now()` |
| `updated_at` | timestamptz | no | `now()` |

| Constraint | Kind | Definition |
| --- | --- | --- |
| `ck_profiles_about_length` | check | `CHECK ((char_length(about) <= 500))` |
| `ck_profiles_age_confirmed` | check | `CHECK (((terms_version = 'legacy'::text) OR (age_confirmed_at IS NOT NULL)))` |
| `ck_profiles_city_length` | check | `CHECK (((city IS NULL) OR (((char_length(city) >= 1) AND (char_length(city) <= 80)) AND (city = btrim(city)))))` |
| `ck_profiles_company_name_length` | check | `CHECK (((company_name IS NULL) OR (((char_length(company_name) >= 1) AND (char_length(company_name) <= 120)) AND (company_name = btrim(company_name)))))` |
| `ck_profiles_country_code` | check | `CHECK ((country_code ~ '^[A-Z]{2}$'::text))` |
| `ck_profiles_discipline` | check | `CHECK ((discipline = ANY (ARRAY['backend'::text, 'frontend'::text, 'full_stack'::text, 'mobile'::text, 'devops_cloud'::text, 'data_ai'::text, 'security'::text, 'qa'::text, 'other'::text])))` |
| `ck_profiles_employment_details` | check | `CHECK (((employment_status <> ALL (ARRAY['employed'::text, 'freelance'::text])) OR ((company_name IS NOT NULL) AND (job_title IS NOT NULL))))` |
| `ck_profiles_employment_status` | check | `CHECK ((employment_status = ANY (ARRAY['employed'::text, 'freelance'::text, 'student'::text, 'between_roles'::text])))` |
| `ck_profiles_github_url_https` | check | `CHECK (((github_url IS NULL) OR ((github_url ~~ 'https://%'::text) AND (char_length(github_url) <= 2048) AND (github_url ~* '^https://([A-Za-z0-9-]+\.)?github\.com([/?#]|$)'::text))))` |
| `ck_profiles_headline_length` | check | `CHECK (((headline IS NULL) OR ((char_length(headline) >= 1) AND (char_length(headline) <= 120))))` |
| `ck_profiles_job_title_length` | check | `CHECK (((job_title IS NULL) OR (((char_length(job_title) >= 1) AND (char_length(job_title) <= 100)) AND (job_title = btrim(job_title)))))` |
| `ck_profiles_linkedin_url_https` | check | `CHECK (((linkedin_url IS NULL) OR ((linkedin_url ~~ 'https://%'::text) AND (char_length(linkedin_url) <= 2048) AND (linkedin_url ~* '^https://([A-Za-z0-9-]+\.)?linkedin\.com([/?#]|$)'::text))))` |
| `ck_profiles_seniority` | check | `CHECK ((seniority = ANY (ARRAY['student_intern'::text, 'junior'::text, 'mid'::text, 'senior'::text, 'lead_or_above'::text])))` |
| `ck_profiles_time_zone_length` | check | `CHECK (((char_length(time_zone) >= 1) AND (char_length(time_zone) <= 64)))` |
| `ck_profiles_website_url_https` | check | `CHECK (((website_url IS NULL) OR ((website_url ~~ 'https://%'::text) AND (char_length(website_url) <= 2048))))` |
| `fk_profiles_user_id_users` | foreign key | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` (on delete cascade) |
| `pk_profiles` | primary key | `PRIMARY KEY (user_id)` |

| Index | Definition |
| --- | --- |

## `profile_skills`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | `gen_random_uuid()` |
| `user_id` | uuid | no |  |
| `name` | text | no |  |
| `sort_order` | smallint | no |  |

| Constraint | Kind | Definition |
| --- | --- | --- |
| `ck_profile_skills_name_length` | check | `CHECK ((((char_length(name) >= 1) AND (char_length(name) <= 30)) AND (name = btrim(name))))` |
| `fk_profile_skills_user_id_users` | foreign key | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` (on delete cascade) |
| `pk_profile_skills` | primary key | `PRIMARY KEY (id)` |
| `trg_profile_skills_limit` | constraint trigger | `TRIGGER DEFERRABLE` |

| Index | Definition |
| --- | --- |
| `ix_profile_skills_user_id` | `CREATE INDEX ix_profile_skills_user_id ON public.profile_skills USING btree (user_id)` |
| `uq_profile_skills_user_id_name_lower` | `CREATE UNIQUE INDEX uq_profile_skills_user_id_name_lower ON public.profile_skills USING btree (user_id, lower(name))` |
