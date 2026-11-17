import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ShoppingCart,
  Pill,
  ShieldCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Plus,
  Minus,
  Loader2,
  ArrowRight,
  Info,
  Sparkles,
} from 'lucide-react';
import { PageTransition } from '../../motion/PageTransition';
import { fadeInUp } from '../../motion/presets';
import { pharmacyCommerceApi, authApi } from '../../services/api';
import type { Medicine, MedicineCategory, Cart } from '../../types';

export const PharmacyStore: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = authApi.getSavedAuth().user;

  const [categories, setCategories] = useState<MedicineCategory[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [rxFilter, setRxFilter] = useState<'ALL' | 'OTC' | 'RX'>('ALL');

  // Detail Modal
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [modalQty, setModalQty] = useState(1);

  // Cart State
  const [cart, setCart] = useState<Cart | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      const data = await pharmacyCommerceApi.getCategories();
      setCategories(data);
    } catch (err: any) {
      console.warn('Could not load categories:', err);
    }
  };

  const fetchMedicines = async () => {
    setLoading(true);
    setError(null);
    try {
      const reqRx = rxFilter === 'ALL' ? undefined : rxFilter === 'RX';
      const data = await pharmacyCommerceApi.getMedicines({
        categoryId: selectedCategory || undefined,
        search: searchQuery.trim() || undefined,
        requiresPrescription: reqRx,
        size: 50,
      });
      setMedicines(data.content || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load medicines from pharmacy catalog');
    } finally {
      setLoading(false);
    }
  };

  const refreshCart = async () => {
    if (!currentUser) return;
    try {
      const cartData = await pharmacyCommerceApi.getCart();
      setCart(cartData);
    } catch {
      // Guest or cart empty
    }
  };

  useEffect(() => {
    fetchCategories();
    refreshCart();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMedicines();
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedCategory, searchQuery, rxFilter]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddToCart = async (medicine: Medicine, qty: number = 1) => {
    if (!currentUser) {
      navigate(`/login?next=${encodeURIComponent('/store')}`);
      return;
    }

    setAddingId(medicine.id);
    try {
      const updated = await pharmacyCommerceApi.addToCart(medicine.id, qty);
      setCart(updated);
      showToast(`Added ${qty} × ${medicine.name} to cart`);
      if (selectedMedicine?.id === medicine.id) {
        setSelectedMedicine(null);
      }
    } catch (err: any) {
      showToast(`Error: ${err?.message || 'Failed to add item to cart'}`);
    } finally {
      setAddingId(null);
    }
  };

  const formatPrice = (paise?: number) => {
    if (!paise) return '₹0.00';
    return `₹${(paise / 100).toFixed(2)}`;
  };

  return (
    <PageTransition style={{ width: '100%', maxWidth: '1440px', margin: '32px auto', padding: '0 24px 80px', boxSizing: 'border-box' }}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            style={{
              position: 'fixed',
              top: 24,
              right: 24,
              zIndex: 9999,
              background: '#0b3f3a',
              color: '#fff',
              padding: '12px 20px',
              borderRadius: 12,
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <CheckCircle2 size={18} color="#5eead4" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Header */}
      <motion.div
        {...fadeInUp}
        style={{
          background: 'linear-gradient(135deg, #0f766e 0%, #0d5c56 100%)',
          borderRadius: 24,
          padding: '40px 36px',
          color: '#fff',
          marginBottom: 32,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 12px 36px rgba(15, 118, 110, 0.15)',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 640 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            <Sparkles size={14} /> Certified Pharmacy E-Commerce
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 12px 0', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            PulseCare Online Pharmacy
          </h1>
          <p style={{ fontSize: 16, color: '#ccfbf1', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            Browse authentic medicines, wellness essentials, and doctor-prescribed therapies. Delivered safely to your door with verified batch standards.
          </p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e6fffa' }}>
              <ShieldCheck size={18} color="#5eead4" /> 100% Genuine Medicines
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e6fffa' }}>
              <CheckCircle2 size={18} color="#5eead4" /> Licensed Pharmacist Verified
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e6fffa' }}>
              <FileText size={18} color="#5eead4" /> Secure Razorpay Checkout
            </div>
          </div>
        </div>

        {/* View Cart Button on hero banner */}
        {cart && cart.totalItemsCount > 0 && (
          <div style={{ position: 'absolute', top: 32, right: 32, zIndex: 2 }}>
            <button
              onClick={() => navigate('/cart')}
              style={{
                background: '#fff',
                color: '#0f766e',
                border: 'none',
                borderRadius: 14,
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
              }}
            >
              <ShoppingCart size={18} />
              <span>Cart ({cart.totalItemsCount})</span>
              <span style={{ background: '#eaf6f2', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>
                {formatPrice(cart.totalPaise)}
              </span>
            </button>
          </div>
        )}
      </motion.div>

      {/* Controls Bar: Search & Category Chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ flex: '1 1 320px', position: 'relative' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#0f766e' }}
            />
            <input
              type="text"
              placeholder="Search medicines by name, brand, or composition..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px 14px 44px',
                borderRadius: 14,
                border: '1.5px solid #d9ece7',
                background: '#fff',
                fontSize: 15,
                color: '#0b3f3a',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.target.style.borderColor = '#0f766e')}
              onBlur={e => (e.target.style.borderColor = '#d9ece7')}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8aa6a0' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Rx Filter Tabs */}
          <div style={{ display: 'flex', background: '#e0f0ec', padding: 4, borderRadius: 12, gap: 4 }}>
            <button
              onClick={() => setRxFilter('ALL')}
              style={{
                border: 'none',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                background: rxFilter === 'ALL' ? '#fff' : 'transparent',
                color: rxFilter === 'ALL' ? '#0f766e' : '#5e7b76',
                boxShadow: rxFilter === 'ALL' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              All Medicines
            </button>
            <button
              onClick={() => setRxFilter('OTC')}
              style={{
                border: 'none',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                background: rxFilter === 'OTC' ? '#fff' : 'transparent',
                color: rxFilter === 'OTC' ? '#0f766e' : '#5e7b76',
                boxShadow: rxFilter === 'OTC' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Over-the-Counter (OTC)
            </button>
            <button
              onClick={() => setRxFilter('RX')}
              style={{
                border: 'none',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                background: rxFilter === 'RX' ? '#fff' : 'transparent',
                color: rxFilter === 'RX' ? '#0f766e' : '#5e7b76',
                boxShadow: rxFilter === 'RX' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Prescription Only (Rx)
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              border: '1px solid',
              borderColor: selectedCategory === null ? '#0f766e' : '#d9ece7',
              background: selectedCategory === null ? '#0f766e' : '#fff',
              color: selectedCategory === null ? '#fff' : '#0b3f3a',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            All Categories
          </button>
          {categories.map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 999,
                  border: '1px solid',
                  borderColor: isSelected ? '#0f766e' : '#d9ece7',
                  background: isSelected ? '#0f766e' : '#fff',
                  color: isSelected ? '#fff' : '#0b3f3a',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Medicines Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, gap: 12, color: '#0f766e' }}>
          <Loader2 className="animate-spin" size={32} />
          <span style={{ fontWeight: 600 }}>Loading medicines...</span>
        </div>
      ) : error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, padding: 24, textAlign: 'center', color: '#991b1b' }}>
          <AlertCircle size={28} style={{ margin: '0 auto 8px' }} />
          <h3 style={{ margin: '0 0 6px 0', fontSize: 16 }}>Unable to load catalog</h3>
          <p style={{ margin: 0, fontSize: 14 }}>{error}</p>
        </div>
      ) : medicines.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #d9ece7', borderRadius: 20, padding: 48, textAlign: 'center', color: '#5e7b76' }}>
          <Pill size={40} color="#0f766e" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#0b3f3a' }}>No medicines found</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 14 }}>Try adjusting your search query or selecting a different category.</p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedCategory(null); setRxFilter('ALL'); }}
            style={{ background: '#0f766e', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {medicines.map(med => {
            const hasDiscount = med.discountedPricePaise && med.discountedPricePaise < med.pricePaise;
            const effectivePrice = hasDiscount ? med.discountedPricePaise! : med.pricePaise;
            const isOutOfStock = med.stockQuantity <= 0;
            const isAdding = addingId === med.id;

            return (
              <motion.div
                key={med.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: '#fff',
                  border: '1px solid #d9ece7',
                  borderRadius: 18,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 12px rgba(11, 63, 58, 0.04)',
                }}
              >
                {/* Image & Badges */}
                <div style={{ position: 'relative', width: '100%', height: 160, background: '#f4faf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={med.imageUrl || '/order-medicine.jpg'}
                    alt={med.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.currentTarget as HTMLImageElement).src = '/order-medicine.jpg'; }}
                  />

                  {/* Prescription / OTC Badge */}
                  <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
                    {med.requiresPrescription ? (
                      <span style={{ background: 'rgba(217, 119, 6, 0.95)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
                        Rx Required
                      </span>
                    ) : (
                      <span style={{ background: 'rgba(15, 118, 110, 0.9)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
                        OTC
                      </span>
                    )}
                  </div>

                  {/* Stock Tag */}
                  <div style={{ position: 'absolute', top: 12, right: 12 }}>
                    {isOutOfStock ? (
                      <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6 }}>
                        Out of Stock
                      </span>
                    ) : med.stockQuantity < 10 ? (
                      <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6 }}>
                        Only {med.stockQuantity} left
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Details Section */}
                <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                    {med.categoryName || 'General Health'}
                  </span>

                  <h3
                    onClick={() => { setSelectedMedicine(med); setModalQty(1); }}
                    style={{ fontSize: 16, fontWeight: 700, color: '#0b3f3a', margin: '0 0 6px 0', cursor: 'pointer', lineHeight: 1.3 }}
                  >
                    {med.name}
                  </h3>

                  <p style={{ fontSize: 12, color: '#5e7b76', margin: '0 0 8px 0', fontWeight: 500 }}>
                    By {med.manufacturer}
                  </p>

                  {med.composition && (
                    <p style={{ fontSize: 12, color: '#7a9691', margin: '0 0 14px 0', lineClamp: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong>Active:</strong> {med.composition}
                    </p>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #eef5f3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: '#0b3f3a' }}>
                          {formatPrice(effectivePrice)}
                        </span>
                        {hasDiscount && (
                          <span style={{ fontSize: 13, color: '#8aa6a0', textDecoration: 'line-through' }}>
                            {formatPrice(med.pricePaise)}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: '#5e7b76' }}>Inclusive of taxes</span>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setSelectedMedicine(med); setModalQty(1); }}
                        title="View Details"
                        style={{
                          background: '#f4faf8',
                          border: '1px solid #d9ece7',
                          color: '#0f766e',
                          borderRadius: 10,
                          padding: '8px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Info size={16} />
                      </button>

                      <button
                        onClick={() => handleAddToCart(med, 1)}
                        disabled={isOutOfStock || isAdding}
                        style={{
                          background: isOutOfStock ? '#e2e8f0' : '#0f766e',
                          color: isOutOfStock ? '#94a3b8' : '#fff',
                          border: 'none',
                          borderRadius: 10,
                          padding: '8px 14px',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {isAdding ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Cart Bar (if items in cart) */}
      <AnimatePresence>
        {cart && cart.totalItemsCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            style={{
              position: 'fixed',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#0b3f3a',
              color: '#fff',
              padding: '14px 24px',
              borderRadius: 999,
              boxShadow: '0 12px 32px rgba(11, 63, 58, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              zIndex: 900,
              maxWidth: 520,
              width: '90%',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={18} color="#5eead4" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {cart.totalItemsCount} {cart.totalItemsCount === 1 ? 'item' : 'items'} in cart
                </div>
                <div style={{ fontSize: 12, color: '#ccfbf1' }}>
                  Total: {formatPrice(cart.totalPaise)}
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/cart')}
              style={{
                background: '#5eead4',
                color: '#0b3f3a',
                border: 'none',
                borderRadius: 999,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>View Cart</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comprehensive Medicine Detail Modal */}
      <AnimatePresence>
        {selectedMedicine && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11, 63, 58, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setSelectedMedicine(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{
                background: '#fff',
                borderRadius: 24,
                width: '100%',
                maxWidth: 680,
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                position: 'relative',
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedMedicine(null)}
                style={{
                  position: 'absolute',
                  top: 18,
                  right: 18,
                  background: '#f0fdfa',
                  border: 'none',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#0f766e',
                  zIndex: 2,
                }}
              >
                <X size={20} />
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {/* Image Side */}
                <div style={{ background: '#f4faf8', padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={selectedMedicine.imageUrl || '/order-medicine.jpg'}
                    alt={selectedMedicine.name}
                    style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 16 }}
                    onError={e => { (e.currentTarget as HTMLImageElement).src = '/order-medicine.jpg'; }}
                  />
                </div>

                {/* Details Side */}
                <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    {selectedMedicine.requiresPrescription ? (
                      <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8 }}>
                        Prescription Required (Rx)
                      </span>
                    ) : (
                      <span style={{ background: '#ccfbf1', color: '#0f766e', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8 }}>
                        Over-the-Counter (OTC)
                      </span>
                    )}
                    <span style={{ background: '#f1f5f9', color: '#475569', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 8 }}>
                      {selectedMedicine.categoryName}
                    </span>
                  </div>

                  <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0b3f3a', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                    {selectedMedicine.name}
                  </h2>
                  <p style={{ fontSize: 14, color: '#5e7b76', margin: '0 0 16px 0' }}>
                    Manufactured by <strong>{selectedMedicine.manufacturer}</strong>
                  </p>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#0b3f3a' }}>
                      {formatPrice(selectedMedicine.discountedPricePaise || selectedMedicine.pricePaise)}
                    </span>
                    {selectedMedicine.discountedPricePaise && selectedMedicine.discountedPricePaise < selectedMedicine.pricePaise && (
                      <span style={{ fontSize: 15, color: '#8aa6a0', textDecoration: 'line-through' }}>
                        {formatPrice(selectedMedicine.pricePaise)}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#0f766e', fontWeight: 600 }}>
                      {selectedMedicine.stockQuantity > 0 ? `${selectedMedicine.stockQuantity} units available` : 'Out of Stock'}
                    </span>
                  </div>

                  {/* Quantity & Add */}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #d9ece7', borderRadius: 12, background: '#f4faf8' }}>
                      <button
                        onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                        disabled={modalQty <= 1}
                        style={{ border: 'none', background: 'none', padding: '8px 12px', cursor: 'pointer', color: '#0f766e' }}
                      >
                        <Minus size={16} />
                      </button>
                      <span style={{ padding: '0 8px', fontWeight: 700, fontSize: 15, color: '#0b3f3a' }}>
                        {modalQty}
                      </span>
                      <button
                        onClick={() => setModalQty(Math.min(selectedMedicine.stockQuantity, modalQty + 1))}
                        disabled={modalQty >= selectedMedicine.stockQuantity}
                        style={{ border: 'none', background: 'none', padding: '8px 12px', cursor: 'pointer', color: '#0f766e' }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <button
                      onClick={() => handleAddToCart(selectedMedicine, modalQty)}
                      disabled={selectedMedicine.stockQuantity <= 0 || addingId === selectedMedicine.id}
                      style={{
                        flex: 1,
                        background: selectedMedicine.stockQuantity <= 0 ? '#cbd5e1' : '#0f766e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '12px 20px',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: selectedMedicine.stockQuantity <= 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      {addingId === selectedMedicine.id ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
                      <span>Add to Cart ({formatPrice((selectedMedicine.discountedPricePaise || selectedMedicine.pricePaise) * modalQty)})</span>
                    </button>
                  </div>

                  {/* Accordion / Medical Information Tabs */}
                  <div style={{ borderTop: '1px solid #eef5f3', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {selectedMedicine.composition && (
                      <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0b3f3a', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Active Composition
                        </h4>
                        <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                          {selectedMedicine.composition}
                        </p>
                      </div>
                    )}

                    {selectedMedicine.description && (
                      <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0b3f3a', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Description
                        </h4>
                        <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                          {selectedMedicine.description}
                        </p>
                      </div>
                    )}

                    {selectedMedicine.dosageInformation && (
                      <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0b3f3a', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Dosage Guidelines
                        </h4>
                        <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                          {selectedMedicine.dosageInformation}
                        </p>
                      </div>
                    )}

                    {selectedMedicine.usageInstructions && (
                      <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0b3f3a', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Usage & Safety Instructions
                        </h4>
                        <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                          {selectedMedicine.usageInstructions}
                        </p>
                      </div>
                    )}

                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                      <strong>Medical Disclaimer:</strong> Do not use as personalized medical advice. Always consult a licensed clinician. Follow prescribed dosage.
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};

