import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ShoppingBag,
  MapPin,
  CreditCard,
  AlertCircle,
  Loader2,
  Receipt,
} from 'lucide-react';
import { PageTransition } from '../../motion/PageTransition';
import { fadeInUp } from '../../motion/presets';
import { pharmacyCommerceApi } from '../../services/api';
import type { CommerceOrder } from '../../types';
import { downloadPdfBlob } from '../../utils/pharmacyCartUtils';

export const PharmacyCustomerOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);

  const handleDownloadInvoice = async (orderId: string, orderNumber: string) => {
    try {
      setDownloadingOrderId(orderId);
      await downloadPdfBlob(
        pharmacyCommerceApi.invoicePdfUrl(orderId),
        `PulseCare_Pharmacy_Invoice_${orderNumber || orderId}.pdf`
      );
    } catch {
      alert('Invoice download failed. Please try again.');
    } finally {
      setDownloadingOrderId(null);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pharmacyCommerceApi.getMyOrders();
      setOrders(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load pharmacy orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const formatPrice = (paise?: number) => {
    if (!paise) return '₹0.00';
    return `₹${(paise / 100).toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLACED':
      case 'CONFIRMED':
        return { bg: '#e0f2fe', text: '#0369a1', label: 'Order Confirmed' };
      case 'PROCESSING':
        return { bg: '#fef3c7', text: '#92400e', label: 'Processing' };
      case 'SHIPPED':
        return { bg: '#f0fdf4', text: '#15803d', label: 'Shipped' };
      case 'DELIVERED':
        return { bg: '#dcfce7', text: '#166534', label: 'Delivered' };
      case 'CANCELLED':
        return { bg: '#fee2e2', text: '#991b1b', label: 'Cancelled' };
      default:
        return { bg: '#f1f5f9', text: '#475569', label: status };
    }
  };

  return (
    <PageTransition style={{ width: '100%', maxWidth: '1000px', margin: '36px auto', padding: '0 24px 80px', boxSizing: 'border-box' }}>
      <button
        onClick={() => navigate('/store')}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#0f766e',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '6px 0',
          marginBottom: 20,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <ArrowLeft size={16} /> Back to Pharmacy Store
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0b3f3a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            My Pharmacy Purchases
          </h1>
          <p style={{ color: '#5e7b76', margin: 0, fontSize: 14 }}>
            Track your medicine shipments, view order details, and payment receipts.
          </p>
        </div>

        <button
          onClick={() => navigate('/store')}
          style={{
            background: '#0f766e',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Order Medicines
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, gap: 12, color: '#0f766e' }}>
          <Loader2 className="animate-spin" size={32} />
          <span style={{ fontWeight: 600 }}>Loading orders...</span>
        </div>
      ) : error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, padding: 24, textAlign: 'center', color: '#991b1b' }}>
          <AlertCircle size={28} style={{ margin: '0 auto 8px' }} />
          <p style={{ margin: 0, fontSize: 14 }}>{error}</p>
        </div>
      ) : orders.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #d9ece7', borderRadius: 24, padding: '56px 24px', textAlign: 'center', color: '#5e7b76' }}>
          <ShoppingBag size={52} color="#0f766e" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0b3f3a', margin: '0 0 8px 0' }}>No pharmacy purchases yet</h3>
          <p style={{ margin: '0 0 24px 0', fontSize: 15, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
            When you purchase medicines through PulseCare Pharmacy, your orders will appear here.
          </p>
          <button
            onClick={() => navigate('/store')}
            style={{
              background: '#0f766e',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '12px 28px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Visit Pharmacy Store
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {orders.map(order => {
            const statusConfig = getStatusColor(order.orderStatus);
            const isPaymentSuccess = order.paymentStatus === 'SUCCESS';

            return (
              <motion.div
                key={order.id}
                {...fadeInUp}
                style={{
                  background: '#fff',
                  border: '1px solid #d9ece7',
                  borderRadius: 20,
                  overflow: 'hidden',
                  boxShadow: '0 2px 10px rgba(11, 63, 58, 0.04)',
                }}
              >
                {/* Header Strip */}
                <div style={{ background: '#f8fafc', padding: '16px 24px', borderBottom: '1px solid #eef5f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Order Number</span>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0b3f3a' }}>{order.orderNumber}</div>
                    </div>

                    <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 16 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Placed On</span>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
                        {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span
                      style={{
                        background: statusConfig.bg,
                        color: statusConfig.text,
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 8,
                      }}
                    >
                      {statusConfig.label}
                    </span>

                    <span
                      style={{
                        background: isPaymentSuccess ? '#ccfbf1' : '#fee2e2',
                        color: isPaymentSuccess ? '#0f766e' : '#991b1b',
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 8,
                      }}
                    >
                      Payment: {order.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Items & Shipping Body */}
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                    {/* Items Purchased */}
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0b3f3a', margin: '0 0 12px 0' }}>
                        Purchased Items ({order.items?.length || 0})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {order.items?.map(item => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#334155' }}>
                            <span>
                              <strong>{item.quantity}×</strong> {item.medicineName}
                            </span>
                            <span style={{ fontWeight: 600 }}>{formatPrice(item.totalPaise)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Financial Totals */}
                      <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 12, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#64748b' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Subtotal</span>
                          <span>{formatPrice(order.subtotalPaise)}</span>
                        </div>
                        {order.discountPaise > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                            <span>Savings</span>
                            <span>-{formatPrice(order.discountPaise)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Delivery Fee</span>
                          <span>{order.deliveryFeePaise === 0 ? 'FREE' : formatPrice(order.deliveryFeePaise)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: '#0b3f3a', paddingTop: 6, borderTop: '1px dashed #e2e8f0' }}>
                          <span>Total Paid</span>
                          <span style={{ color: '#0f766e' }}>{formatPrice(order.totalPaise)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delivery & Payment details */}
                    <div style={{ background: '#f8fafc', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#0b3f3a', marginBottom: 8 }}>
                        <MapPin size={16} color="#0f766e" /> Delivery Destination
                      </div>
                      <div style={{ color: '#475569', lineHeight: 1.5, marginBottom: 14 }}>
                        <strong>{order.deliveryName}</strong> ({order.deliveryPhone})<br />
                        {order.deliveryStreet}<br />
                        {order.deliveryCity}, {order.deliveryState} - {order.deliveryPincode}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#0b3f3a', marginBottom: 8 }}>
                        <CreditCard size={16} color="#0f766e" /> Razorpay Payment Reference
                      </div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>
                        <div>Order Ref: <code>{order.razorpayOrderId || 'N/A'}</code></div>
                        {order.razorpayPaymentId && (
                          <div>Payment ID: <code>{order.razorpayPaymentId}</code></div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(order.id, order.orderNumber)}
                        disabled={downloadingOrderId === order.id}
                        style={{
                          marginTop: 14,
                          width: '100%',
                          background: '#0f766e',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 10,
                          padding: '9px 14px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: downloadingOrderId === order.id ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: '0 2px 6px rgba(15, 118, 110, 0.2)',
                        }}
                      >
                        {downloadingOrderId === order.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Receipt size={14} />
                        )}
                        Download Tax Invoice (PDF)
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </PageTransition>
  );
};
