"""Minimal profile: two name columns on users, profiles and profile_skills (MF-19, ADR-609).

Every rule of pack section 5 is a named constraint. The controlled lists are read from
`config/profile_lists.json`, the same file the API and the frontend use (ADR-607). Existing users
get a profile with neutral values and `legacy` terms, so nothing is lost (ADR-608). The downgrade
drops both tables and both columns.

Revision ID: 0008
Revises: 0007
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.domain import lists

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _url(column: str, host: str | None = None) -> str:
    parts = [f"{column} IS NULL OR ({column} LIKE 'https://%' AND char_length({column}) <= 2048"]
    if host is not None:
        parts.append(f" AND {column} ~* '^https://([A-Za-z0-9-]+\\.)?{host}([/?#]|$)'")
    return "".join(parts) + ")"


def _trimmed(column: str, longest: int) -> str:
    return (
        f"{column} IS NULL OR "
        f"(char_length({column}) BETWEEN 1 AND {longest} AND {column} = btrim({column}))"
    )


def _limit_function() -> str:
    return """
    CREATE FUNCTION profile_skills_limit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      -- One writer at a time per person, so two concurrent inserts cannot both see nine rows.
      PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));
      IF (SELECT count(*) FROM profile_skills WHERE user_id = NEW.user_id) > 10 THEN
        RAISE EXCEPTION 'A person may have at most 10 skills'
          USING ERRCODE = '23514', CONSTRAINT = 'ck_profile_skills_max_per_user';
      END IF;
      RETURN NULL;
    END $$;
    """


def upgrade() -> None:
    op.add_column("users", sa.Column("given_name", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("family_name", sa.Text(), nullable=True))
    op.create_check_constraint(
        op.f("ck_users_given_name_length"),
        "users",
        "given_name IS NULL OR "
        "(char_length(given_name) BETWEEN 1 AND 60 AND given_name = btrim(given_name))",
    )
    op.create_check_constraint(
        op.f("ck_users_family_name_length"),
        "users",
        "family_name IS NULL OR "
        "(char_length(family_name) BETWEEN 1 AND 60 AND family_name = btrim(family_name))",
    )

    op.create_table(
        "profiles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("discipline", sa.Text(), nullable=False),
        sa.Column("seniority", sa.Text(), nullable=False),
        sa.Column("employment_status", sa.Text(), nullable=False),
        sa.Column("company_name", sa.Text(), nullable=True),
        sa.Column("job_title", sa.Text(), nullable=True),
        sa.Column("country_code", sa.Text(), nullable=False),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("time_zone", sa.Text(), nullable=False),
        sa.Column("headline", sa.Text(), nullable=True),
        sa.Column("about", sa.Text(), server_default="", nullable=False),
        sa.Column("github_url", sa.Text(), nullable=True),
        sa.Column("linkedin_url", sa.Text(), nullable=True),
        sa.Column("website_url", sa.Text(), nullable=True),
        sa.Column(
            "show_professional_details",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("terms_version", sa.Text(), nullable=False),
        sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("age_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            lists.sql_in("discipline", lists.DISCIPLINES), name=op.f("ck_profiles_discipline")
        ),
        sa.CheckConstraint(
            lists.sql_in("seniority", lists.SENIORITIES), name=op.f("ck_profiles_seniority")
        ),
        sa.CheckConstraint(
            lists.sql_in("employment_status", lists.EMPLOYMENT_STATUSES),
            name=op.f("ck_profiles_employment_status"),
        ),
        sa.CheckConstraint(
            _trimmed("company_name", 120), name=op.f("ck_profiles_company_name_length")
        ),
        sa.CheckConstraint(_trimmed("job_title", 100), name=op.f("ck_profiles_job_title_length")),
        sa.CheckConstraint(
            "employment_status NOT IN ('employed', 'freelance') "
            "OR (company_name IS NOT NULL AND job_title IS NOT NULL)",
            name=op.f("ck_profiles_employment_details"),
        ),
        sa.CheckConstraint("country_code ~ '^[A-Z]{2}$'", name=op.f("ck_profiles_country_code")),
        sa.CheckConstraint(_trimmed("city", 80), name=op.f("ck_profiles_city_length")),
        sa.CheckConstraint(
            "char_length(time_zone) BETWEEN 1 AND 64", name=op.f("ck_profiles_time_zone_length")
        ),
        sa.CheckConstraint(
            "headline IS NULL OR char_length(headline) BETWEEN 1 AND 120",
            name=op.f("ck_profiles_headline_length"),
        ),
        sa.CheckConstraint("char_length(about) <= 500", name=op.f("ck_profiles_about_length")),
        sa.CheckConstraint(
            _url("github_url", "github\\.com"), name=op.f("ck_profiles_github_url_https")
        ),
        sa.CheckConstraint(
            _url("linkedin_url", "linkedin\\.com"), name=op.f("ck_profiles_linkedin_url_https")
        ),
        sa.CheckConstraint(_url("website_url"), name=op.f("ck_profiles_website_url_https")),
        sa.CheckConstraint(
            "terms_version = 'legacy' OR age_confirmed_at IS NOT NULL",
            name=op.f("ck_profiles_age_confirmed"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_profiles_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_profiles")),
    )

    op.create_table(
        "profile_skills",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint(
            "char_length(name) BETWEEN 1 AND 30 AND name = btrim(name)",
            name=op.f("ck_profile_skills_name_length"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_profile_skills_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_profile_skills")),
    )
    op.create_index(op.f("ix_profile_skills_user_id"), "profile_skills", ["user_id"])
    op.create_index(
        "uq_profile_skills_user_id_name_lower",
        "profile_skills",
        ["user_id", sa.text("lower(name)")],
        unique=True,
    )
    op.execute(_limit_function())
    op.execute(
        "CREATE CONSTRAINT TRIGGER trg_profile_skills_limit AFTER INSERT ON profile_skills "
        "DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION profile_skills_limit()"
    )

    # Existing people keep everything and get neutral, honest values (ADR-608).
    op.get_bind().execute(
        sa.text(
            "INSERT INTO profiles (user_id, discipline, seniority, employment_status, "
            "country_code, time_zone, terms_version, terms_accepted_at) "
            "SELECT id, 'other', 'mid', 'between_roles', :unknown, 'UTC', 'legacy', created_at "
            "FROM users"
        ),
        {"unknown": lists.UNKNOWN_COUNTRY},
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER trg_profile_skills_limit ON profile_skills")
    op.execute("DROP FUNCTION profile_skills_limit()")
    op.drop_index("uq_profile_skills_user_id_name_lower", table_name="profile_skills")
    op.drop_index(op.f("ix_profile_skills_user_id"), table_name="profile_skills")
    op.drop_table("profile_skills")
    op.drop_table("profiles")
    op.drop_constraint(op.f("ck_users_family_name_length"), "users", type_="check")
    op.drop_constraint(op.f("ck_users_given_name_length"), "users", type_="check")
    op.drop_column("users", "family_name")
    op.drop_column("users", "given_name")
