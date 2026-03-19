from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, LandlordProfile

# ── Inline for LandlordProfile ─────────────────────────────────────────────
class LandlordProfileInline(admin.StackedInline):
    model = LandlordProfile
    can_delete = False
    verbose_name_plural = "Landlord Profile"
    # Optional: make document_file clickable
    readonly_fields = ('document_file',)

# ── Custom UserAdmin ───────────────────────────────────────────────────────
class UserAdmin(BaseUserAdmin):
    model = User
    list_display = ('username', 'email', 'phone', 'role', 'is_staff', 'is_active')
    list_filter = ('role', 'is_staff', 'is_active')
    fieldsets = (
        (None, {'fields': ('username', 'email', 'phone', 'password', 'role')}),
        ('Permissions', {'fields': ('is_staff', 'is_active', 'groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'phone', 'password1', 'password2', 'role', 'is_staff', 'is_active')}
        ),
    )
    search_fields = ('username', 'email', 'phone')
    ordering = ('username',)
    inlines = (LandlordProfileInline,)  # <-- Add the inline here

# ── Register ───────────────────────────────────────────────────────────────
admin.site.register(User, UserAdmin)