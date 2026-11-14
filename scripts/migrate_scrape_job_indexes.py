"""Create additive indexes used by user-scoped scrape job lookups."""

import backend.utils.env_loader
from sqlalchemy import inspect

from backend.db.database import engine
from backend.db.models import ScrapeJob, ScrapeJobHistory


def migrate() -> None:
    tables = set(inspect(engine).get_table_names())
    indexes = (
        *ScrapeJob.__table__.indexes,
        *ScrapeJobHistory.__table__.indexes,
    )
    for index in indexes:
        if index.table.name in tables and index.name in {
            "ix_scrape_jobs_user_job",
            "ix_scrape_job_histories_user_job",
            "ix_scrape_job_histories_user_created",
        }:
            index.create(bind=engine, checkfirst=True)


if __name__ == "__main__":
    migrate()
    print("Scrape job indexes are up to date.")
