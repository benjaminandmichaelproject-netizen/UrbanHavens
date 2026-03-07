from django.shortcuts import render

# Create your views here.
from rest_framework import generics
from .models import Property
from .serializers import PropertySerializer


class PropertyListView(generics.ListAPIView):
    queryset = Property.objects.all()
    serializer_class = PropertySerializer