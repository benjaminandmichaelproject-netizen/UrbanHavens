from io import BytesIO
from pathlib import Path

from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image, ImageOps


# Maximum width or height allowed for a compressed property image.
MAX_IMAGE_DIMENSION = 1920

# WebP quality balances image clarity and smaller file size.
WEBP_QUALITY = 80


def compress_property_image(uploaded_image):
    """
    Resize and compress a property image before it is saved.

    The image is automatically rotated, resized to a maximum of
    1920 pixels, converted to WebP, and compressed at quality 80.
    """
    if not uploaded_image:
        return uploaded_image

    # Open the uploaded image using Pillow.
    image = Image.open(uploaded_image)

    # Correct orientation using the image's EXIF metadata.
    image = ImageOps.exif_transpose(image)

    # Convert unsupported colour modes before saving as WebP.
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")

    # Resize only when the image is larger than the allowed dimensions.
    image.thumbnail(
        (MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION),
        Image.Resampling.LANCZOS,
    )

    # Store the compressed image temporarily in memory.
    output = BytesIO()

    image.save(
        output,
        format="WEBP",
        quality=WEBP_QUALITY,
        method=6,
        optimize=True,
    )

    output.seek(0)

    # Replace the original extension with .webp.
    original_name = Path(uploaded_image.name).stem
    compressed_name = f"{original_name}.webp"

    # Return a Django-compatible uploaded image.
    return InMemoryUploadedFile(
        file=output,
        field_name="image",
        name=compressed_name,
        content_type="image/webp",
        size=output.getbuffer().nbytes,
        charset=None,
    )