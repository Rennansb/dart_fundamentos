import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Package, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const deliveryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const shopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function DeliveryTracking() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deliveryCode, setDeliveryCode] = useState('');
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [shopLocation, setShopLocation] = useState<[number, number] | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const orderRef = doc(db, 'purchase_orders', orderId);
    const unsubscribe = onSnapshot(orderRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOrder({ id: docSnap.id, ...data });
        
        // Derive shop location if not present
        if (data.shopLocation) {
          setShopLocation([data.shopLocation.lat, data.shopLocation.lng]);
        } else if (data.deliveryAddress) {
          // Fetch coordinates using OpenStreetMap Nominatim
          fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(data.deliveryAddress)}`)
            .then(res => res.json())
            .then(results => {
              if (results && results.length > 0) {
                setShopLocation([parseFloat(results[0].lat), parseFloat(results[0].lon)]);
              }
            })
            .catch(err => console.error("Geocoding failed:", err));
        }
      } else {
        setError('Pedido não encontrado.');
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('Erro ao carregar pedido.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    if (!orderId || success || order?.status === 'recebido') return;

    let watchId: number;

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation([latitude, longitude]);
          
          try {
            await updateDoc(doc(db, 'purchase_orders', orderId), {
              deliveryLocation: { lat: latitude, lng: longitude },
              lastLocationUpdate: serverTimestamp()
            });
          } catch (err) {
            console.error('Error updating location:', err);
          }
        },
        (err) => {
          console.error('Geolocation error:', err);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [orderId, success, order?.status]);

  const handleConfirmDelivery = async () => {
    if (!order) return;
    if (deliveryCode !== order.deliveryCode) {
      alert('Código de entrega incorreto! Por favor, solicite o código ao lojista.');
      return;
    }

    try {
      const response = await fetch('/api/delivery/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, code: deliveryCode })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao confirmar entrega');
      }

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao confirmar entrega.');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>;

  if (success || order?.status === 'recebido') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Entrega Concluída!</h1>
          <p className="text-gray-600">O pedido foi entregue com sucesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-indigo-600 text-white p-4 shadow-md">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6" />
          Entrega de Pedido
        </h1>
        <p className="text-indigo-100 text-sm mt-1">ID: {order?.id.substring(0, 8)}</p>
      </div>

      <div className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-500" />
            Local de Entrega
          </h2>
          <p className="text-gray-700">{order?.shopName}</p>
          <p className="text-gray-500 text-sm">{order?.deliveryAddress || 'Endereço não informado'}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-64 relative z-0">
          {currentLocation ? (
            <MapContainer center={currentLocation} zoom={15} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              {/* Driver Marker */}
              <Marker position={currentLocation} icon={deliveryIcon}>
                <Popup>Localização do Entregador</Popup>
              </Marker>

              {/* Shop Marker */}
              {shopLocation && (
                <Marker position={shopLocation} icon={shopIcon}>
                  <Popup>Sua Oficina (Local de Entrega)</Popup>
                </Marker>
              )}

              <MapUpdater center={currentLocation} />
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-100 text-gray-500">
              Obtendo localização...
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mt-auto">
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg mb-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-800">
              Solicite o código de entrega ao cliente após ele conferir a peça.
            </p>
          </div>
          
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Código de Entrega
          </label>
          <input
            type="text"
            value={deliveryCode}
            onChange={(e) => setDeliveryCode(e.target.value)}
            placeholder="Digite o código de 6 dígitos"
            className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
            maxLength={6}
          />
          <button
            onClick={handleConfirmDelivery}
            disabled={deliveryCode.length !== 6}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Confirmar Entrega
          </button>
        </div>
      </div>
    </div>
  );
}
