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

    # Builds a concise social-media description.
    share_description = (
        f"{property_obj.city}, {region_name} · "
        f"GH₵{property_obj.price:,.2f}"
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