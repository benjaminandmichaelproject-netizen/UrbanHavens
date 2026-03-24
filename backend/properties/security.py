from decimal import Decimal
from math import radians, sin, cos, sqrt, atan2

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import Property, PropertyDuplicateMatch


# ---------------------------------------------------------------------------
# Stopwords — stripped before text similarity so generic filler words
# ("a nice room with shared bathroom") don't inflate Jaccard scores.
# ---------------------------------------------------------------------------
_STOPWORDS = {
    "a", "an", "the", "is", "in", "of", "and", "or", "with", "to", "for",
    "at", "by", "on", "it", "be", "as", "are", "was", "has", "have", "this",
    "that", "from", "not", "but", "we", "they", "he", "she", "you", "i",
    "its", "our", "your", "all", "also", "very", "just", "will", "can",
}


def is_similar_price(price1, price2, tolerance_percent=10):
    """
    Return True when price1 and price2 are within tolerance_percent of
    each other.

    FIX: original used price2 as the denominator, making comparison
    asymmetric — is_similar_price(90, 100) != is_similar_price(100, 90).
    Now uses the average of both prices so order doesn't matter.
    """
    if price1 is None or price2 is None:
        return False

    price1 = Decimal(str(price1))
    price2 = Decimal(str(price2))

    if price1 == 0 and price2 == 0:
        return True

    avg = (price1 + price2) / Decimal("2")
    if avg == 0:
        return False

    difference = abs(price1 - price2)
    allowed_difference = (Decimal(str(tolerance_percent)) / Decimal("100")) * avg
    return difference <= allowed_difference


def normalize_text(value):
    if not value:
        return ""
    return " ".join(str(value).strip().lower().split())


def calculate_text_similarity(text1, text2):
    """
    Token-overlap (Jaccard) similarity between two strings.
    Returns a float between 0.0 and 1.0.

    FIX: stopwords are removed before comparison so generic prose
    ("a nice room in the hostel with shared bathroom") doesn't produce
    artificially high scores between unrelated descriptions.
    """
    text1 = normalize_text(text1)
    text2 = normalize_text(text2)

    if not text1 or not text2:
        return 0.0

    tokens1 = set(text1.split()) - _STOPWORDS
    tokens2 = set(text2.split()) - _STOPWORDS

    if not tokens1 or not tokens2:
        return 0.0

    return len(tokens1 & tokens2) / len(tokens1 | tokens2)


def get_distance_meters(lat1, lng1, lat2, lng2):
    """
    Haversine formula. Returns distance in metres, or None if any
    coordinate is missing.
    """
    if None in [lat1, lng1, lat2, lng2]:
        return None

    r = 6_371_000  # Earth radius in metres

    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    )
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c


def get_property_image_hashes(property_instance):
    """
    Return a set of non-empty image hashes for property_instance.
    Queries the DB directly — only call this ONCE per check, before the loop.
    """
    return set(
        property_instance.images
        .exclude(image_hash__isnull=True)
        .exclude(image_hash__exact="")
        .values_list("image_hash", flat=True)
    )


def _has_duplicate_image(current_hashes, other_property):
    """
    Compare pre-fetched current_hashes against other_property's images.
    Uses the prefetch cache (other_property.images.all() hits no extra
    queries when the queryset was evaluated with prefetch_related).

    FIX: original called get_property_image_hashes(property_instance)
    inside the loop — same query re-executed N times. Now current_hashes
    is computed once outside the loop and passed in.
    """
    if not current_hashes:
        return False

    other_hashes = {
        img.image_hash
        for img in other_property.images.all()
        if img.image_hash
    }
    return bool(current_hashes & other_hashes)


def check_duplicate_property(property_instance):
    """
    Scan all other-owner properties for duplicate signals and write the
    results to PropertyDuplicateMatch.

    Performance contract:
      - The candidate queryset is evaluated ONCE as a list (forcing
        prefetch_related to batch the image queries).
      - current_hashes is computed ONCE before the loop.
      - All DB writes happen inside a single atomic block with a
        select_for_update() row-lock to prevent concurrent-call races.
      - Matches are written with bulk_create(update_conflicts=True) to
        avoid IntegrityError from the UniqueConstraint on concurrent runs.

    Call site:
      This function is designed to be called from a background task
      (Celery / Django-Q) triggered via transaction.on_commit(), NOT
      synchronously inside the request/response cycle.
    """
    if not property_instance:
        return

    # ------------------------------------------------------------------ #
    #  Build the candidate queryset                                       #
    # ------------------------------------------------------------------ #
    candidate_qs = (
        Property.objects
        .exclude(id=property_instance.id)
        .prefetch_related("images")
    )

    # Exclude same registered owner so a landlord's own portfolio never
    # self-flags.
    if property_instance.owner_id:
        candidate_qs = candidate_qs.exclude(owner_id=property_instance.owner_id)

    # Exclude same external landlord for the same reason.
    if property_instance.external_landlord_id:
        candidate_qs = candidate_qs.exclude(
            external_landlord_id=property_instance.external_landlord_id
        )

    # FIX: evaluate the queryset into a list HERE so prefetch_related fires
    # as a single batched query before the loop, instead of potentially
    # being deferred or sliced in ways that defeat the prefetch.
    candidates = list(candidate_qs)

    # FIX: compute once before the loop — original called this inside
    # has_duplicate_image() on every iteration, meaning N extra queries.
    current_hashes = get_property_image_hashes(property_instance)

    # ------------------------------------------------------------------ #
    #  Score each candidate                                               #
    # ------------------------------------------------------------------ #
    matches_found = []

    for other in candidates:
        weak_score = 0
        strong_score = 0
        reasons = []

        # ── Weak signals ──────────────────────────────────────────────
        if property_instance.region and other.region:
            if normalize_text(property_instance.region) == normalize_text(other.region):
                weak_score += 1
                reasons.append("same region")

        if property_instance.city and other.city:
            if normalize_text(property_instance.city) == normalize_text(other.city):
                weak_score += 1
                reasons.append("same city")

        if property_instance.school and other.school:
            if normalize_text(property_instance.school) == normalize_text(other.school):
                weak_score += 1
                reasons.append("same school")

        if property_instance.category and other.category:
            if normalize_text(property_instance.category) == normalize_text(other.category):
                weak_score += 1
                reasons.append("same category")

        if property_instance.bedrooms is not None and other.bedrooms is not None:
            if property_instance.bedrooms == other.bedrooms:
                weak_score += 1
                reasons.append("same bedrooms")

        if property_instance.bathrooms is not None and other.bathrooms is not None:
            if property_instance.bathrooms == other.bathrooms:
                weak_score += 1
                reasons.append("same bathrooms")

        if is_similar_price(property_instance.price, other.price):
            weak_score += 1
            reasons.append("similar price")

        # ── Strong signals ────────────────────────────────────────────
        if property_instance.property_name and other.property_name:
            if normalize_text(property_instance.property_name) == normalize_text(other.property_name):
                strong_score += 1
                reasons.append("same property name")

        distance = get_distance_meters(
            property_instance.lat,
            property_instance.lng,
            other.lat,
            other.lng,
        )
        if distance is not None and distance <= 30:
            strong_score += 1
            reasons.append("very close coordinates")

        description_similarity = calculate_text_similarity(
            property_instance.description,
            other.description,
        )
        if description_similarity >= 0.75:
            strong_score += 1
            reasons.append("very similar description")

        # FIX: pass pre-computed current_hashes instead of re-querying
        if _has_duplicate_image(current_hashes, other):
            strong_score += 1
            reasons.append("duplicate property image")

        # ── Flag rule: enough weak context + at least one hard signal ──
        if weak_score >= 4 and strong_score >= 1:
            total_score = weak_score + (strong_score * 2)
            matches_found.append({
                "matched_property": other,
                "score": total_score,
                "reason": ", ".join(reasons),
            })

    # ------------------------------------------------------------------ #
    #  Write results atomically                                           #
    # ------------------------------------------------------------------ #
    # FIX: wrap ALL writes in a single atomic block.
    # Original wrote the security flags, then deleted old matches, then
    # created new ones in separate DB calls — if any step failed you'd
    # get a flagged property with missing or stale match records.
    #
    # select_for_update() locks the property row so concurrent calls
    # (e.g. Celery retry + original task running simultaneously) can't
    # both pass the delete step and then race on the UniqueConstraint.
    with transaction.atomic():
        # Re-fetch with a row lock to prevent concurrent race.
        locked_instance = Property.objects.select_for_update().get(
            pk=property_instance.pk
        )

        if matches_found:
            locked_instance.security_flagged = True
            locked_instance.security_flag_type = "duplicate_property"
            locked_instance.security_flag_reason = (
                "Possible duplicate listing detected from another user account."
            )
            locked_instance.security_flagged_at = timezone.now()
            locked_instance.security_under_review = True
            locked_instance.save(update_fields=[
                "security_flagged",
                "security_flag_type",
                "security_flag_reason",
                "security_flagged_at",
                "security_under_review",
            ])

            # Delete stale matches — both directions.
            # FIX: original only deleted where property=instance; the
            # reverse side (matched_property=instance) was left as stale
            # orphan records pointing at this property from other listings.
            PropertyDuplicateMatch.objects.filter(
                Q(property=locked_instance) | Q(matched_property=locked_instance)
            ).delete()

            # FIX: bulk_create with update_conflicts=True instead of
            # per-row create() in a loop. Handles concurrent calls that
            # might try to insert the same pair simultaneously — instead
            # of crashing on the UniqueConstraint, it upserts cleanly.
            PropertyDuplicateMatch.objects.bulk_create(
                [
                    PropertyDuplicateMatch(
                        property=locked_instance,
                        matched_property=m["matched_property"],
                        match_reason=m["reason"],
                        match_score=m["score"],
                    )
                    for m in matches_found
                ],
                update_conflicts=True,
                unique_fields=["property", "matched_property"],
                update_fields=["match_reason", "match_score"],
            )

        else:
            locked_instance.security_flagged = False
            locked_instance.security_flag_type = None
            locked_instance.security_flag_reason = None
            locked_instance.security_flagged_at = None
            locked_instance.security_under_review = False
            locked_instance.save(update_fields=[
                "security_flagged",
                "security_flag_type",
                "security_flag_reason",
                "security_flagged_at",
                "security_under_review",
            ])

            # FIX: clean up both directions, not just forward matches.
            PropertyDuplicateMatch.objects.filter(
                Q(property=locked_instance) | Q(matched_property=locked_instance)
            ).delete()