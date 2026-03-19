import json
from rest_framework import serializers
from .models import Property, PropertyImage


class PropertyImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = PropertyImage
        fields = ["id", "image"]

    def get_image(self, obj):
        request = self.context.get("request")
        if obj.image:
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None


class FlexibleJSONField(serializers.Field):
    def to_internal_value(self, data):
        if data in [None, "", []]:
            return []

        if isinstance(data, (list, dict)):
            return data

        if isinstance(data, str):
            try:
                parsed = json.loads(data)
                if not isinstance(parsed, (list, dict)):
                    raise serializers.ValidationError("Must be a JSON array or object.")
                return parsed
            except json.JSONDecodeError:
                raise serializers.ValidationError("Invalid JSON string.")

        raise serializers.ValidationError("Unsupported type for JSON field.")

    def to_representation(self, value):
        if value in [None, ""]:
            return []

        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value

        return value


class PropertySerializer(serializers.ModelSerializer):
    images = PropertyImageSerializer(many=True, read_only=True)
    amenities = FlexibleJSONField(required=False)

    owner_id = serializers.IntegerField(source="owner.id", read_only=True)
    owner_name = serializers.CharField(source="owner.username", read_only=True)
    owner_phone = serializers.CharField(source="owner.phone", read_only=True)

    class Meta:
        model = Property
        fields = [
            "id",
            "owner_id",
            "owner_name",
            "owner_phone",
            "property_name",
            "category",
            "property_type",
            "bedrooms",
            "bathrooms",
            "price",
            "description",
            "amenities",
            "region",
            "city",
            "school",
            "lat",
            "lng",
            "images",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "owner_id",
            "owner_name",
            "owner_phone",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        request = self.context.get("request")

        property_obj = Property.objects.create(**validated_data)

        if request:
            for image in request.FILES.getlist("property_images"):
                PropertyImage.objects.create(property=property_obj, image=image)

        return property_obj