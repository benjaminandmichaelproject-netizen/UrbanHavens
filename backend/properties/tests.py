from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from properties.models import ExternalLandlord, Property

User = get_user_model()


class PropertyTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = User.objects.create_user(
            email="admin@example.com",
            username="admin",
            password="pass123",
            role="admin",
        )

        self.owner = User.objects.create_user(
            email="owner@example.com",
            username="owner",
            password="pass123",
            role="owner",
        )

        self.other_owner = User.objects.create_user(
            email="otherowner@example.com",
            username="otherowner",
            password="pass123",
            role="owner",
        )

        self.external_landlord = ExternalLandlord.objects.create(
            full_name="External Guy",
            document_type="passport",
            id_number="EXT123",
            document_file="dummy.pdf",
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def create_property(self, **kwargs):
        data = {
            "owner": self.owner,
            "property_name": "Test Property",
            "category": "hostel",
            "bedrooms": 2,
            "bathrooms": 1,
            "price": 1000,
            "description": "Test description",
            "region": "Greater Accra",
            "city": "Accra",
        }
        data.update(kwargs)
        return Property.objects.create(**data)

    # -------------------------
    # Existing ownership tests
    # -------------------------

    def test_owner_can_create_property_for_self(self):
        self.authenticate(self.owner)

        response = self.client.post(
            "/api/properties/",
            {
                "property_name": "Test Property",
                "category": "hostel",
                "bedrooms": 2,
                "bathrooms": 1,
                "price": 1000,
                "description": "Test",
                "region": "Greater Accra",
                "city": "Accra",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Property.objects.count(), 1)

        property_obj = Property.objects.first()
        self.assertEqual(property_obj.owner, self.owner)
        self.assertEqual(property_obj.approval_status, "pending")
        self.assertFalse(property_obj.is_featured)

    def test_owner_cannot_assign_another_owner(self):
        self.authenticate(self.owner)

        response = self.client.post(
            "/api/properties/",
            {
                "owner_user_id": self.owner.id,
                "property_name": "Invalid",
                "category": "hostel",
                "bedrooms": 1,
                "bathrooms": 1,
                "price": 500,
                "description": "Test",
                "region": "Greater Accra",
                "city": "Accra",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)

    def test_admin_can_assign_registered_owner(self):
        self.authenticate(self.admin)

        response = self.client.post(
            "/api/properties/",
            {
                "owner_user_id": self.owner.id,
                "property_name": "Admin Assigned",
                "category": "hostel",
                "bedrooms": 2,
                "bathrooms": 2,
                "price": 1500,
                "description": "Test",
                "region": "Greater Accra",
                "city": "Accra",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Property.objects.count(), 1)

        property_obj = Property.objects.first()
        self.assertEqual(property_obj.owner, self.owner)
        self.assertEqual(property_obj.approval_status, "pending")

    def test_admin_can_use_existing_external_landlord(self):
        self.authenticate(self.admin)

        response = self.client.post(
            "/api/properties/",
            {
                "external_landlord_id": self.external_landlord.id,
                "property_name": "External Property",
                "category": "hostel",
                "bedrooms": 3,
                "bathrooms": 2,
                "price": 2000,
                "description": "Test",
                "region": "Greater Accra",
                "city": "Accra",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Property.objects.count(), 1)

        property_obj = Property.objects.first()
        self.assertEqual(property_obj.external_landlord, self.external_landlord)
        self.assertEqual(property_obj.approval_status, "pending")

    def test_admin_must_choose_one_owner_source(self):
        self.authenticate(self.admin)

        response = self.client.post(
            "/api/properties/",
            {
                "property_name": "Invalid",
                "category": "hostel",
                "bedrooms": 1,
                "bathrooms": 1,
                "price": 500,
                "description": "Test",
                "region": "Greater Accra",
                "city": "Accra",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)

    def test_cannot_change_ownership_on_update(self):
        self.authenticate(self.admin)

        property_obj = self.create_property()

        response = self.client.patch(
            f"/api/properties/{property_obj.id}/",
            {"external_landlord_id": self.external_landlord.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    # -------------------------
    # New moderation tests
    # -------------------------

    def test_property_defaults_to_pending(self):
        property_obj = self.create_property()

        self.assertEqual(property_obj.approval_status, "pending")
        self.assertFalse(property_obj.is_featured)
        self.assertIsNone(property_obj.approved_by)
        self.assertIsNone(property_obj.approved_at)

    def test_public_list_shows_only_approved_properties(self):
        self.create_property(property_name="Pending One", approval_status="pending")
        approved_property = self.create_property(
            property_name="Approved One",
            approval_status="approved",
            approved_by=self.admin,
        )

        response = self.client.get("/api/properties/")

        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", [])
        ids = [item["id"] for item in results]

        self.assertIn(approved_property.id, ids)
        self.assertEqual(len(ids), 1)

    def test_public_cannot_retrieve_pending_property(self):
        property_obj = self.create_property(approval_status="pending")

        response = self.client.get(f"/api/properties/{property_obj.id}/")

        self.assertEqual(response.status_code, 404)

    def test_owner_can_retrieve_own_pending_property(self):
        property_obj = self.create_property(approval_status="pending")

        self.authenticate(self.owner)
        response = self.client.get(f"/api/properties/{property_obj.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], property_obj.id)

    def test_other_owner_cannot_retrieve_someone_elses_pending_property(self):
        property_obj = self.create_property(approval_status="pending")

        self.authenticate(self.other_owner)
        response = self.client.get(f"/api/properties/{property_obj.id}/")

        self.assertEqual(response.status_code, 404)

    def test_admin_can_approve_property(self):
        property_obj = self.create_property(approval_status="pending")

        self.authenticate(self.admin)
        response = self.client.post(f"/api/properties/{property_obj.id}/approve/")

        self.assertEqual(response.status_code, 200)

        property_obj.refresh_from_db()
        self.assertEqual(property_obj.approval_status, "approved")
        self.assertEqual(property_obj.approved_by, self.admin)
        self.assertIsNotNone(property_obj.approved_at)

    def test_admin_can_reject_property(self):
        property_obj = self.create_property(
            approval_status="approved",
            is_featured=False,
            approved_by=self.admin,
        )

        self.authenticate(self.admin)
        response = self.client.post(f"/api/properties/{property_obj.id}/reject/")

        self.assertEqual(response.status_code, 200)

        property_obj.refresh_from_db()
        self.assertEqual(property_obj.approval_status, "rejected")
        self.assertFalse(property_obj.is_featured)
        self.assertIsNone(property_obj.approved_by)
        self.assertIsNone(property_obj.approved_at)

    def test_admin_cannot_feature_unapproved_property(self):
        property_obj = self.create_property(approval_status="pending")

        self.authenticate(self.admin)
        response = self.client.post(f"/api/properties/{property_obj.id}/feature/")

        self.assertEqual(response.status_code, 400)

        property_obj.refresh_from_db()
        self.assertFalse(property_obj.is_featured)

    def test_admin_can_feature_approved_property(self):
        property_obj = self.create_property(
            approval_status="approved",
            approved_by=self.admin,
        )

        self.authenticate(self.admin)
        response = self.client.post(f"/api/properties/{property_obj.id}/feature/")

        self.assertEqual(response.status_code, 200)

        property_obj.refresh_from_db()
        self.assertTrue(property_obj.is_featured)

    def test_featured_endpoint_returns_only_approved_featured_properties(self):
        featured_property = self.create_property(
            property_name="Featured Approved",
            approval_status="approved",
            is_featured=True,
            approved_by=self.admin,
        )
        self.create_property(
            property_name="Approved Not Featured",
            approval_status="approved",
            is_featured=False,
            approved_by=self.admin,
        )
        self.create_property(
            property_name="Pending Featured Attempt",
            approval_status="pending",
            is_featured=False,
        )

        response = self.client.get("/api/properties/featured/")

        self.assertEqual(response.status_code, 200)
        returned_ids = [item["id"] for item in response.data]

        self.assertIn(featured_property.id, returned_ids)
        self.assertEqual(len(returned_ids), 1)

    def test_admin_list_requires_admin(self):
        self.authenticate(self.owner)
        response = self.client.get("/api/properties/admin-list/")

        self.assertEqual(response.status_code, 403)

    def test_admin_list_returns_all_statuses_for_admin(self):
        self.create_property(property_name="Pending", approval_status="pending")
        self.create_property(
            property_name="Approved",
            approval_status="approved",
            approved_by=self.admin,
        )
        self.create_property(property_name="Rejected", approval_status="rejected")

        self.authenticate(self.admin)
        response = self.client.get("/api/properties/admin-list/")

        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", [])
        statuses = sorted([item["approval_status"] for item in results])

        self.assertEqual(statuses, ["approved", "pending", "rejected"])