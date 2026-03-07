from rest_framework import generics
from .models import Rental
from .serializers import RentalSerializer

class RentalListView(generics.ListAPIView):
    queryset = Rental.objects.all()
    serializer_class = RentalSerializer


class RentalDetailView(generics.RetrieveAPIView):
    queryset = Rental.objects.all()
    serializer_class = RentalSerializer