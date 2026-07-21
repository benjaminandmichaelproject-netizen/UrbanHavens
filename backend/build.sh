#!/usr/bin/env bash

# Stop the build immediately if any command fails.
set -o errexit

# Install the exact Python dependencies.
pip install -r requirements.txt

# Gather Django admin and application static files for WhiteNoise.
python manage.py collectstatic --noinput

# Apply all database migrations to the production database.
python manage.py migrate