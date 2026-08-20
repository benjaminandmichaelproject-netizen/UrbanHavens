from django.http import Http404
from django.shortcuts import render

from .models import Property


def property_share_view(request, property_id):
    """
    Renders share metadata for one approved public property.
    Normal visitors are redirected to the React property details page.
    """

    try:
        # Loads only an approved property that is not hidden by reports.
        property_obj = (
            Property.objects
            .prefetch_related("images")
            .get(
                id=property_id,
                approval_status="approved",
            )
        )
    except Property.DoesNotExist as exc:
        raise Http404("Property not found.") from exc

    # Prevents hidden or actively flagged properties from being shared.
    if property_obj.report_flag_status in {
        "hidden",
        "flagged",
        "reviewing",
    }:
        raise Http404("Property not available.")

    # Uses the first uploaded property image as the social preview image.
    first_image = property_obj.images.order_by("uploaded_at").first()

    property_image = ""

    if first_image and first_image.image:
        # Produces a full HTTPS URL required by WhatsApp and social crawlers.
        property_image = request.build_absolute_uri(
            first_image.image.url
        )

    # Converts the stored region value into its readable display label.
    region_name = property_obj.get_region_display()

    # Multi-unit apartments do not store a price on the parent property.
    # Use the cheapest available unit, falling back to any existing unit.
    is_multi_unit_apartment = (
        property_obj.category == "apartment"
        and property_obj.apartment_listing_type == "multi_unit"
    )

    if is_multi_unit_apartment:
        unit_price = (
            property_obj.apartment_units
            .filter(status="available")
            .order_by("price")
            .values_list("price", flat=True)
            .first()
        )

        if unit_price is None:
            unit_price = (
                property_obj.apartment_units
                .order_by("price")
                .values_list("price", flat=True)
                .first()
            )

        price_text = (
            f"From GHS {unit_price:,.2f}"
            if unit_price is not None
            else "Unit pricing available"
        )
    else:
        # Existing hostel, house, and single-apartment listings
        # continue using their parent property price.
        price_text = (
            f"GHS {property_obj.price:,.2f}"
            if property_obj.price is not None
            else "Price available"
        )

    # Builds a concise social-media description.
    share_description = (
        f"{property_obj.city}, {region_name} · "
        f"{price_text}"
    )

    # Public Vercel URL that users will share.
    share_url = (
        "https://urbanhavensgh.vercel.app"
        f"/share/property/{property_obj.id}"
    )

    # Existing React property details page.
    detail_url = (
        "https://urbanhavensgh.vercel.app"
        f"/detail/{property_obj.id}"
    )

    context = {
        "property_name": property_obj.property_name,
        "share_description": share_description,
        "property_image": property_image,
        "share_url": share_url,
        "detail_url": detail_url,
    }

    return render(
        request,
        "share/property.html",
        context,
    )