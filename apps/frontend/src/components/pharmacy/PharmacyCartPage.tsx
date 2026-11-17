import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Loader2,
  FileText,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import { PageTransition } from '../../motion/PageTransition';
import { pharmacyCommerceApi, authApi } from '../../services/api';
import type { Cart } from '../../types';

export const PharmacyCartPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = authApi.getSavedAuth().user;

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const fetchCart = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await pharmacyCommerceApi.getCart();
      setCart(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load shopping cart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const flashBanner = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 2500);
  };

  const handleUpdateQuantity = async (itemId: string, newQty: number) => {
    setUpdatingId(itemId);
    try {
      const updated = await pharmacyCommerceApi.updateCartItem(itemId, newQty);
      setCart(updated);
    } catch (err: any) {
      flashBanner(err?.message || 'Could not update quantity');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setUpdatingId(itemId);
    try {
      const updated = await pharmacyCommerceApi.removeCartItem(itemId);
      setCart(updated);
      flashBanner('Item removed from cart');
    } catch (err: any) {
      flashBanner(err?.message || 'Could not remove item');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleClearCart = async () => {
    if (!window.confirm('Are you sure you want to clear your cart?')) return;
    setLoading(true);
    try {
      const updated = await pharmacyCommerceApi.clearCart();
      setCart(updated);
      flashBanner('Cart cleared');
    } catch (err: any) {
      flashBanner(err?.message || 'Could not clear cart');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (paise?: number) => {
    if (!paise) return '₹0.00';
    return `₹${(paise / 100).toFixed(2)}`;
  };

  if (!currentUser) {
    return (
      <PageTransition style={{ width: '100%', maxWidth: '800px', margin: '48px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: 48, border: '1px solid #d9ece7' }}>
          <ShoppingCart size={48} color="#0f766e" style={{ margin: '0 auto 16px', opacity: 0.7 }} />
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0b3f3a', margin: '0 0 8px 0' }}>Sign in to view your cart</h2>
          <p style={{ color: '#5e7b76', margin: '0 0 24px 0', fontSize: 15 }}>
            You need to be logged in as a patient to add items, view your cart, and place orders.
          </p>
          <button
            onClick={() => navigate('/login?next=/cart')}
            style={{
              background: '#0f766e',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '12px 28px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Sign In / Register
          </button>
        </div>
      </PageTransition>
    );
  }

  const freeDeliveryThreshold = 50000; // ₹500 in paise
  const missingForFreeDelivery = cart ? Math.max(0, freeDeliveryThreshold - cart.subtotalPaise) : 0;

  return (
    <PageTransition style={{ width: '100%', maxWidth: '1200px', margin: '36px auto', padding: '0 24px 80px', boxSizing: 'border-box' }}>
      {/* Back button */}
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
        <ArrowLeft size={16} /> Continue Shopping
      </button>

      {/* Banner */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              background: '#0b3f3a',
              color: '#fff',
              padding: '12px 18px',
              borderRadius: 12,
              marginBottom: 20,
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <CheckCircle2 size={18} color="#5eead4" /> {banner}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0b3f3a', margin: 0, letterSpacing: '-0.02em' }}>
            Shopping Cart
          </h1>
          <p style={{ color: '#5e7b76', margin: '4px 0 0 0', fontSize: 14 }}>
            Review your selected medicines and proceed to secure checkout.
          </p>
        </div>

        {cart && cart.items.length > 0 && (
          <button
            onClick={handleClearCart}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ef4444',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Trash2 size={15} /> Clear Cart
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, gap: 12, color: '#0f766e' }}>
          <Loader2 className="animate-spin" size={32} />
          <span style={{ fontWeight: 600 }}>Loading your cart...</span>
        </div>
      ) : error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, padding: 24, textAlign: 'center', color: '#991b1b' }}>
          <AlertTriangle size={28} style={{ margin: '0 auto 8px' }} />
          <p style={{ margin: 0, fontSize: 14 }}>{error}</p>
        </div>
      ) : !cart || cart.items.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #d9ece7', borderRadius: 24, padding: '56px 24px', textAlign: 'center', color: '#5e7b76' }}>
          <ShoppingCart size={52} color="#0f766e" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0b3f3a', margin: '0 0 8px 0' }}>Your cart is empty</h3>
          <p style={{ margin: '0 0 24px 0', fontSize: 15, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
            You haven't added any medicines yet. Explore our wide range of authentic pharmaceuticals and healthcare essentials.
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
            Browse Pharmacy Store
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32, alignItems: 'start' }}>
          {/* Left Column: Cart Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Prescription Warning Banner */}
            {cart.hasPrescriptionItems && (
              <div
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: 16,
                  padding: '16px 20px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  color: '#92400e',
                }}
              >
                <FileText size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700 }}>
                    Prescription Required Items
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4 }}>
                    Your cart contains prescription medications. You will be asked to select or provide a doctor-signed prescription during checkout.
                  </p>
                </div>
              </div>
            )}

            {/* Items Card List */}
            {cart.items.map(item => {
              const isUpdating = updatingId === item.id;
              return (
                <div
                  key={item.id}
                  style={{
                    background: '#fff',
                    border: '1px solid #d9ece7',
                    borderRadius: 18,
                    padding: '18px 20px',
                    display: 'flex',
                    gap: 18,
                    alignItems: 'center',
                    boxShadow: '0 2px 8px rgba(11, 63, 58, 0.04)',
                  }}
                >
                  <img
                    src={item.imageUrl || '/order-medicine.jpg'}
                    alt={item.medicineName}
                    style={{ width: 72, height: 72, objectFit: 'contain', background: '#f4faf8', borderRadius: 12, padding: 4 }}
                    onError={e => { (e.currentTarget as HTMLImageElement).src = '/order-medicine.jpg'; }}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0b3f3a', margin: 0 }}>
                        {item.medicineName}
                      </h4>
                      {item.requiresPrescription && (
                        <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                          Rx
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: 12, color: '#5e7b76', margin: '0 0 8px 0' }}>
                      By {item.manufacturer}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0b3f3a' }}>
                        {formatPrice(item.effectivePricePaise)}
                      </span>
                      {item.discountedPricePaise && item.discountedPricePaise < item.pricePaise && (
                        <span style={{ fontSize: 12, color: '#8aa6a0', textDecoration: 'line-through' }}>
                          {formatPrice(item.pricePaise)}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: '#8aa6a0' }}>/ unit</span>
                    </div>
                  </div>

                  {/* Quantity Increment/Decrement */}
                  <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #d9ece7', borderRadius: 10, background: '#f4faf8' }}>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                      disabled={isUpdating}
                      style={{ border: 'none', background: 'none', padding: '6px 10px', cursor: 'pointer', color: '#0f766e' }}
                    >
                      <Minus size={14} />
                    </button>
                    <span style={{ padding: '0 6px', fontWeight: 700, fontSize: 14, color: '#0b3f3a', minWidth: 20, textAlign: 'center' }}>
                      {isUpdating ? <Loader2 size={12} className="animate-spin" /> : item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                      disabled={isUpdating || item.quantity >= item.availableStock}
                      style={{ border: 'none', background: 'none', padding: '6px 10px', cursor: 'pointer', color: '#0f766e' }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Item Total & Remove */}
                  <div style={{ textAlign: 'right', minWidth: 80 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0b3f3a', marginBottom: 6 }}>
                      {formatPrice(item.itemTotalPaise)}
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={isUpdating}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Order Summary & Checkout */}
          <div style={{ position: 'sticky', top: 24 }}>
            <div
              style={{
                background: '#fff',
                border: '1px solid #d9ece7',
                borderRadius: 22,
                padding: '28px 24px',
                boxShadow: '0 8px 24px rgba(11, 63, 58, 0.05)',
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0b3f3a', margin: '0 0 16px 0' }}>
                Order Summary
              </h3>

              {/* Free delivery tracker */}
              <div style={{ background: '#f4faf8', borderRadius: 14, padding: '12px 16px', marginBottom: 20, border: '1px solid #e0f0ec' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#0f766e', marginBottom: 6 }}>
                  <Truck size={16} />
                  {missingForFreeDelivery > 0 ? (
                    <span>Add {formatPrice(missingForFreeDelivery)} more for <strong>FREE Delivery</strong></span>
                  ) : (
                    <span>You've unlocked <strong>FREE Delivery!</strong></span>
                  )}
                </div>
                <div style={{ background: '#d9ece7', borderRadius: 999, height: 6, width: '100%', overflow: 'hidden' }}>
                  <div
                    style={{
                      background: '#0f766e',
                      height: '100%',
                      width: `${Math.min(100, (cart.subtotalPaise / freeDeliveryThreshold) * 100)}%`,
                      borderRadius: 999,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Summary line items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#5e7b76' }}>
                  <span>Items Subtotal ({cart.totalItemsCount})</span>
                  <span style={{ fontWeight: 600, color: '#0b3f3a' }}>{formatPrice(cart.subtotalPaise)}</span>
                </div>

                {cart.discountPaise > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#16a34a' }}>
                    <span>Discounts & Savings</span>
                    <span style={{ fontWeight: 600 }}>-{formatPrice(cart.discountPaise)}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#5e7b76' }}>
                  <span>Delivery Fee</span>
                  <span style={{ fontWeight: 600, color: cart.deliveryFeePaise === 0 ? '#16a34a' : '#0b3f3a' }}>
                    {cart.deliveryFeePaise === 0 ? 'FREE' : formatPrice(cart.deliveryFeePaise)}
                  </span>
                </div>

                <div style={{ borderTop: '1px solid #eef5f3', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#0b3f3a' }}>Total Amount</span>
                    <div style={{ fontSize: 11, color: '#8aa6a0' }}>Includes applicable GST</div>
                  </div>
                  <span style={{ fontSize: 24, fontWeight: 800, color: '#0f766e' }}>
                    {formatPrice(cart.totalPaise)}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={() => navigate('/checkout')}
                style={{
                  width: '100%',
                  background: '#0f766e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 14,
                  padding: '14px 20px',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(15, 118, 110, 0.25)',
                  marginBottom: 16,
                }}
              >
                <span>Proceed to Checkout</span>
                <ArrowRight size={18} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: '#5e7b76' }}>
                <ShieldCheck size={16} color="#0f766e" /> Secure 256-bit encrypted checkout
              </div>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
};
