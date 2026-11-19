import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  CreditCard,
  MapPin,
  FileText,
  Loader2,
  ShoppingBag,
  Zap,
} from 'lucide-react';
import { PageTransition } from '../../motion/PageTransition';
import { fadeInUp } from '../../motion/presets';
import {
  pharmacyCommerceApi,
  prescriptionsApi,
  profileApi,
  authApi,
} from '../../services/api';
import type { Cart, CommerceOrder, Prescription } from '../../types';

export const PharmacyCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser] = useState(() => authApi.getSavedAuth().user);

  const [cart, setCart] = useState<Cart | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Address fields
  const [deliveryName, setDeliveryName] = useState(currentUser?.fullName || '');
  const [deliveryPhone, setDeliveryPhone] = useState(currentUser?.phone || '');
  const [deliveryStreet, setDeliveryStreet] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [deliveryPincode, setDeliveryPincode] = useState('');
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState('');

  // Confirmation state
  const [confirmedOrder, setConfirmedOrder] = useState<CommerceOrder | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login?next=/checkout');
      return;
    }

    const initData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [cartData, profileData, rxList] = await Promise.all([
          pharmacyCommerceApi.getCart(),
          profileApi.get().catch(() => null),
          prescriptionsApi.mine().catch(() => [] as Prescription[]),
        ]);

        if (!cartData || cartData.items.length === 0) {
          navigate('/cart');
          return;
        }

        setCart(cartData);

        // Pre-fill address if available
        if (profileData) {
          if (profileData.fullName) setDeliveryName(prev => prev || profileData.fullName || '');
          if (profileData.phone) setDeliveryPhone(prev => prev || profileData.phone || '');
          if (profileData.addressStreet) setDeliveryStreet(prev => prev || profileData.addressStreet || '');
          if (profileData.addressCity) setDeliveryCity(prev => prev || profileData.addressCity || '');
          if (profileData.addressState) setDeliveryState(prev => prev || profileData.addressState || '');
          if (profileData.addressPincode) setDeliveryPincode(prev => prev || profileData.addressPincode || '');
        }

        // Filter signed prescriptions
        const signedRxs = (rxList || []).filter(r => r.status === 'SIGNED');
        setPrescriptions(signedRxs);
        if (signedRxs.length > 0) {
          setSelectedPrescriptionId(prev => prev || signedRxs[0].id);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load checkout details');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [navigate]);

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise(resolve => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePlaceOrder = async (e: React.FormEvent, forceSandbox: boolean = false) => {
    e.preventDefault();
    if (!cart || cart.items.length === 0) return;

    if (!deliveryName.trim() || !deliveryPhone.trim() || !deliveryStreet.trim() || !deliveryCity.trim() || !deliveryState.trim() || !deliveryPincode.trim()) {
      setError('Please fill in all required delivery address fields.');
      return;
    }

    if (!forceSandbox && cart.hasPrescriptionItems && prescriptions.length > 0 && !selectedPrescriptionId) {
      setError('Your cart contains prescription items. Please select a valid doctor-signed prescription.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create order on backend — supports both normal Prescription Buy and Force Buy (dev/sandbox waiver)
      const hasPrescription = cart.hasPrescriptionItems && selectedPrescriptionId;
      const isForceBuy = forceSandbox || (cart.hasPrescriptionItems && !hasPrescription);

      const checkoutResp = await pharmacyCommerceApi.createCheckoutOrder({
        deliveryName: deliveryName.trim(),
        deliveryPhone: deliveryPhone.trim(),
        deliveryStreet: deliveryStreet.trim(),
        deliveryCity: deliveryCity.trim(),
        deliveryState: deliveryState.trim(),
        deliveryPincode: deliveryPincode.trim(),
        prescriptionId: hasPrescription ? selectedPrescriptionId : undefined,
        notes: (orderNotes.trim() ? orderNotes.trim() + ' ' : '') + (isForceBuy ? '[FORCE_BUY]' : ''),
        forceBuy: isForceBuy,
      });

      if (forceSandbox) {
        // User explicitly chose "Instant Test / Sandbox Payment"
        const fallbackPaymentId = 'pay_sim_' + Math.random().toString(36).substring(2, 10);
        const verifiedOrder = await pharmacyCommerceApi.verifyPayment({
          razorpayOrderId: checkoutResp.razorpayOrderId,
          razorpayPaymentId: fallbackPaymentId,
          razorpaySignature: 'sandbox_signature',
        });
        setConfirmedOrder(verifiedOrder);
        setSubmitting(false);
        return;
      }

      // User chose "Pay with Razorpay" -> Launch real Razorpay Payment Window without bypassing
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded) {
        throw new Error('Razorpay SDK script could not be loaded. Please check your internet connection or use Instant Test Payment.');
      }

      // 2. Open official Razorpay Checkout dialog
      const options: any = {
        key: checkoutResp.keyId || 'rzp_test_TuvH1793SLzCcO',
        amount: checkoutResp.amountPaise,
        currency: checkoutResp.currency || 'INR',
        name: 'PulseCare Online Pharmacy',
        description: `Order ${checkoutResp.orderNumber}`,
        prefill: {
          name: deliveryName,
          email: currentUser?.email || 'patient@pulsecare.com',
          contact: deliveryPhone,
        },
        theme: {
          color: '#0f766e',
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
          },
        },
        handler: async function (resp: any) {
          try {
            const verifiedOrder = await pharmacyCommerceApi.verifyPayment({
              razorpayOrderId: checkoutResp.razorpayOrderId,
              razorpayPaymentId: resp.razorpay_payment_id || ('pay_' + Math.random().toString(36).substring(2, 10)),
              razorpaySignature: resp.razorpay_signature || 'sandbox_signature',
            });
            setConfirmedOrder(verifiedOrder);
          } catch (verifyErr: any) {
            setError(verifyErr?.message || 'Payment verification failed. Please contact support.');
          } finally {
            setSubmitting(false);
          }
        },
      };

      // Only pass order_id if it was created on Razorpay cloud servers, not offline/simulated,
      // so the Razorpay checkout modal opens smoothly in test mode without 400 ID validation errors!
      if (checkoutResp.razorpayOrderId && !checkoutResp.razorpayOrderId.startsWith('order_sim_')) {
        options.order_id = checkoutResp.razorpayOrderId;
      }

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        setError(`Payment failed: ${resp.error?.description || 'Transaction cancelled'}`);
        setSubmitting(false);
      });
      rzp.open();
    } catch (err: any) {
      console.warn('Razorpay checkout error:', err);
      setError(err?.message || 'Failed to complete checkout');
      setSubmitting(false);
    }
  };

  const formatPrice = (paise?: number) => {
    if (!paise) return '₹0.00';
    return `₹${(paise / 100).toFixed(2)}`;
  };

  if (confirmedOrder) {
    return (
      <PageTransition style={{ width: '100%', maxWidth: '800px', margin: '48px auto', padding: '0 24px', boxSizing: 'border-box' }}>
        <motion.div
          {...fadeInUp}
          style={{
            background: '#fff',
            borderRadius: 24,
            padding: '48px 36px',
            border: '1px solid #d9ece7',
            textAlign: 'center',
            boxShadow: '0 12px 32px rgba(11, 63, 58, 0.08)',
          }}
        >
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={36} color="#0f766e" />
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0b3f3a', margin: '0 0 8px 0' }}>
            Order Placed Successfully!
          </h1>
          <p style={{ color: '#5e7b76', fontSize: 15, margin: '0 0 24px 0' }}>
            Thank you for ordering with PulseCare Pharmacy. Your medicines are being verified and prepared for dispatch.
          </p>

          <div style={{ background: '#f4faf8', borderRadius: 16, padding: '20px 24px', border: '1px solid #d9ece7', marginBottom: 28, textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid #e0f0ec', paddingBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#5e7b76' }}>Order Number:</span>
              <strong style={{ fontSize: 14, color: '#0b3f3a' }}>{confirmedOrder.orderNumber}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid #e0f0ec', paddingBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#5e7b76' }}>Payment Status:</span>
              <span style={{ background: '#ccfbf1', color: '#0f766e', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                {confirmedOrder.paymentStatus}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid #e0f0ec', paddingBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#5e7b76' }}>Delivery To:</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0b3f3a', textAlign: 'right' }}>
                {confirmedOrder.deliveryName}<br />
                {confirmedOrder.deliveryStreet}, {confirmedOrder.deliveryCity}, {confirmedOrder.deliveryPincode}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#5e7b76' }}>Total Amount Paid:</span>
              <strong style={{ fontSize: 16, color: '#0f766e' }}>{formatPrice(confirmedOrder.totalPaise)}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/orders/pharmacy')}
              style={{
                background: '#0f766e',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ShoppingBag size={18} /> View My Orders
            </button>
            <button
              onClick={() => navigate('/store')}
              style={{
                background: '#f4faf8',
                color: '#0f766e',
                border: '1px solid #d9ece7',
                borderRadius: 12,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Back to Store
            </button>
          </div>
        </motion.div>
      </PageTransition>
    );
  }

  return (
    <PageTransition style={{ width: '100%', maxWidth: '1200px', margin: '36px auto', padding: '0 24px 80px', boxSizing: 'border-box' }}>
      <button
        onClick={() => navigate('/cart')}
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
        <ArrowLeft size={16} /> Back to Cart
      </button>

      <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0b3f3a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
        Checkout & Payment
      </h1>
      <p style={{ color: '#5e7b76', margin: '0 0 28px 0', fontSize: 14 }}>
        Enter your shipping details and complete payment through secure Razorpay.
      </p>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '14px 18px', marginBottom: 24, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={18} />
          <span style={{ fontSize: 14 }}>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, gap: 12, color: '#0f766e' }}>
          <Loader2 className="animate-spin" size={32} />
          <span style={{ fontWeight: 600 }}>Loading checkout details...</span>
        </div>
      ) : (
        <form onSubmit={handlePlaceOrder} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32, alignItems: 'start' }}>
          {/* Left Form: Delivery Address & Prescription */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Delivery Address Card */}
            <div style={{ background: '#fff', border: '1px solid #d9ece7', borderRadius: 20, padding: 28, boxShadow: '0 2px 10px rgba(11, 63, 58, 0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e0f0ec', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={16} color="#0f766e" />
                </div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0b3f3a' }}>
                  Delivery Address
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0b3f3a', marginBottom: 6 }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={deliveryName}
                    onChange={e => setDeliveryName(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #d9ece7', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0b3f3a', marginBottom: 6 }}>
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={deliveryPhone}
                    onChange={e => setDeliveryPhone(e.target.value)}
                    placeholder="+919876543210"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #d9ece7', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0b3f3a', marginBottom: 6 }}>
                    Street Address / House No / Landmark *
                  </label>
                  <input
                    type="text"
                    required
                    value={deliveryStreet}
                    onChange={e => setDeliveryStreet(e.target.value)}
                    placeholder="Flat 301, Lakeview Apts, 12th Main Road"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #d9ece7', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0b3f3a', marginBottom: 6 }}>
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={deliveryCity}
                    onChange={e => setDeliveryCity(e.target.value)}
                    placeholder="Bengaluru"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #d9ece7', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0b3f3a', marginBottom: 6 }}>
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    value={deliveryState}
                    onChange={e => setDeliveryState(e.target.value)}
                    placeholder="Karnataka"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #d9ece7', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0b3f3a', marginBottom: 6 }}>
                    Pincode / Postal Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={deliveryPincode}
                    onChange={e => setDeliveryPincode(e.target.value)}
                    placeholder="560001"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #d9ece7', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0b3f3a', marginBottom: 6 }}>
                    Delivery Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    placeholder="Leave at security gate"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #d9ece7', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* Prescription Selection (if required) */}
            {cart?.hasPrescriptionItems && (
              <div style={{ background: '#fff', border: '1px solid #fcd34d', borderRadius: 20, padding: 28, boxShadow: '0 2px 10px rgba(11, 63, 58, 0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={16} color="#d97706" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0b3f3a' }}>
                      Attach Signed Doctor Prescription *
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#92400e' }}>
                      Required by clinical regulations for one or more medicines in your cart.
                    </p>
                  </div>
                </div>

                {prescriptions.length === 0 ? (
                  <div style={{ background: '#f0fdf4', padding: 18, borderRadius: 12, border: '1px dashed #86efac', fontSize: 13, color: '#166534' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>
                      No doctor-signed clinical prescriptions found on your account.
                    </p>
                    <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#15803d' }}>
                      ✓ Sandbox Testing Waiver Active: You can complete test checkout directly, or book a consultation with a specialist doctor.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/book')}
                      style={{ background: '#0f766e', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Book a Doctor Consultation
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {prescriptions.map(rx => {
                      const isSelected = selectedPrescriptionId === rx.id;
                      return (
                        <div
                          key={rx.id}
                          onClick={() => setSelectedPrescriptionId(rx.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 18px',
                            borderRadius: 12,
                            border: '1.5px solid',
                            borderColor: isSelected ? '#0f766e' : '#e2e8f0',
                            background: isSelected ? '#f0fdfa' : '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid', borderColor: isSelected ? '#0f766e' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {isSelected && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0f766e' }} />}
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#0b3f3a' }}>
                                Signed Prescription #{rx.id.substring(0, 8).toUpperCase()}
                              </div>
                              <div style={{ fontSize: 12, color: '#5e7b76' }}>
                                Signed: {rx.signedAt ? new Date(rx.signedAt).toLocaleDateString() : 'Active'}
                              </div>
                            </div>
                          </div>

                          <span style={{ background: '#ccfbf1', color: '#0f766e', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>
                            VERIFIED
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Order Review & Razorpay Trigger */}
          <div style={{ position: 'sticky', top: 24 }}>
            <div style={{ background: '#fff', border: '1px solid #d9ece7', borderRadius: 22, padding: '28px 24px', boxShadow: '0 8px 24px rgba(11, 63, 58, 0.05)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0b3f3a', margin: '0 0 16px 0' }}>
                Order Items ({cart?.totalItemsCount})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 220, overflowY: 'auto', marginBottom: 20, paddingRight: 4 }}>
                {cart?.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: '#0b3f3a' }}>{item.quantity}×</span>
                      <span style={{ color: '#475569' }}>{item.medicineName}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: '#0b3f3a' }}>{formatPrice(item.itemTotalPaise)}</span>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div style={{ borderTop: '1px solid #eef5f3', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#5e7b76' }}>
                  <span>Subtotal</span>
                  <span style={{ fontWeight: 600, color: '#0b3f3a' }}>{formatPrice(cart?.subtotalPaise)}</span>
                </div>

                {cart && cart.discountPaise > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#16a34a' }}>
                    <span>Savings</span>
                    <span style={{ fontWeight: 600 }}>-{formatPrice(cart.discountPaise)}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#5e7b76' }}>
                  <span>Delivery Fee</span>
                  <span style={{ fontWeight: 600, color: cart?.deliveryFeePaise === 0 ? '#16a34a' : '#0b3f3a' }}>
                    {cart?.deliveryFeePaise === 0 ? 'FREE' : formatPrice(cart?.deliveryFeePaise)}
                  </span>
                </div>

                <div style={{ borderTop: '1px solid #eef5f3', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#0b3f3a' }}>Total Payable</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: '#0f766e' }}>
                    {formatPrice(cart?.totalPaise)}
                  </span>
                </div>
              </div>

              {/* Dual Action Buttons: Live Razorpay & Instant Test Sandbox */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <button
                  type="submit"
                  disabled={submitting || (cart?.hasPrescriptionItems && prescriptions.length > 0 && !selectedPrescriptionId)}
                  style={{
                    width: '100%',
                    background: submitting ? '#0d5c56' : '#0f766e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 14,
                    padding: '14px 20px',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: submitting ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(15, 118, 110, 0.25)',
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Processing Payment...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard size={18} />
                      <span>Pay with Razorpay ({formatPrice(cart?.totalPaise)})</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => handlePlaceOrder(e as any, true)}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    background: '#f0fdf9',
                    color: '#0f766e',
                    border: '1.5px solid #0f766e',
                    borderRadius: 14,
                    padding: '12px 18px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: submitting ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                  title="Complete instant sandbox payment without external gateway"
                >
                  <Zap size={16} color="#0f766e" />
                  <span>Instant Test / Sandbox Payment</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: '#5e7b76' }}>
                <ShieldCheck size={16} color="#0f766e" /> Razorpay official payments & signature verification
              </div>
            </div>
          </div>
        </form>
      )}
    </PageTransition>
  );
};
