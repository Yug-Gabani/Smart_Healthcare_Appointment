package com.group6.healthcare.pharmacy.service;

import com.group6.healthcare.common.exception.ResourceNotFoundException;
import com.group6.healthcare.pharmacy.dto.AddToCartRequest;
import com.group6.healthcare.pharmacy.dto.CartItemResponse;
import com.group6.healthcare.pharmacy.dto.CartResponse;
import com.group6.healthcare.pharmacy.dto.UpdateCartItemRequest;
import com.group6.healthcare.pharmacy.entity.Medicine;
import com.group6.healthcare.pharmacy.entity.PharmacyCart;
import com.group6.healthcare.pharmacy.entity.PharmacyCartItem;
import com.group6.healthcare.pharmacy.repository.MedicineRepository;
import com.group6.healthcare.pharmacy.repository.PharmacyCartItemRepository;
import com.group6.healthcare.pharmacy.repository.PharmacyCartRepository;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class PharmacyCartService {

    public static final long FREE_DELIVERY_THRESHOLD_PAISE = 50000L; // ₹500
    public static final long STANDARD_DELIVERY_FEE_PAISE = 5000L;    // ₹50

    private final PharmacyCartRepository cartRepository;
    private final PharmacyCartItemRepository cartItemRepository;
    private final MedicineRepository medicineRepository;
    private final UserRepository userRepository;

    public PharmacyCartService(
            PharmacyCartRepository cartRepository,
            PharmacyCartItemRepository cartItemRepository,
            MedicineRepository medicineRepository,
            UserRepository userRepository
    ) {
        this.cartRepository = cartRepository;
        this.cartItemRepository = cartItemRepository;
        this.medicineRepository = medicineRepository;
        this.userRepository = userRepository;
    }

    public PharmacyCart getOrCreateCart(UUID userId) {
        return cartRepository.findByUserId(userId).orElseGet(() -> {
            userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", userId));
            PharmacyCart newCart = PharmacyCart.builder()
                    .userId(userId)
                    .items(new ArrayList<>())
                    .build();
            return cartRepository.save(newCart);
        });
    }

    @Transactional(readOnly = true)
    public CartResponse getCartResponse(UUID userId) {
        PharmacyCart cart = getOrCreateCart(userId);
        return buildCartResponse(cart);
    }

    public CartResponse addToCart(UUID userId, AddToCartRequest req) {
        PharmacyCart cart = getOrCreateCart(userId);
        Medicine medicine = medicineRepository.findById(req.medicineId())
                .orElseThrow(() -> new ResourceNotFoundException("Medicine", req.medicineId()));

        if (!medicine.isActive()) {
            throw new IllegalArgumentException("Medicine is currently unavailable");
        }

        PharmacyCartItem existingItem = cartItemRepository.findByCartIdAndMedicineId(cart.getId(), medicine.getId())
                .orElse(null);

        int currentQtyInCart = existingItem != null ? existingItem.getQuantity() : 0;
        int requestedTotalQty = currentQtyInCart + req.quantity();

        if (requestedTotalQty > medicine.getStockQuantity()) {
            throw new IllegalArgumentException(String.format(
                    "Cannot add %d units. Only %d units available in stock (%d already in cart).",
                    req.quantity(), medicine.getStockQuantity(), currentQtyInCart));
        }

        if (existingItem != null) {
            existingItem.setQuantity(requestedTotalQty);
            cartItemRepository.save(existingItem);
        } else {
            PharmacyCartItem newItem = PharmacyCartItem.builder()
                    .cart(cart)
                    .medicine(medicine)
                    .quantity(req.quantity())
                    .build();
            cart.getItems().add(newItem);
            cartItemRepository.save(newItem);
        }

        return buildCartResponse(cartRepository.findById(cart.getId()).orElse(cart));
    }

    public CartResponse updateItemQuantity(UUID userId, UUID cartItemId, UpdateCartItemRequest req) {
        PharmacyCart cart = getOrCreateCart(userId);
        PharmacyCartItem item = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new ResourceNotFoundException("Cart item", cartItemId));

        if (!item.getCart().getId().equals(cart.getId())) {
            throw new IllegalArgumentException("Cart item does not belong to user cart");
        }

        if (req.quantity() <= 0) {
            cart.getItems().remove(item);
            cartItemRepository.delete(item);
        } else {
            Medicine medicine = item.getMedicine();
            if (req.quantity() > medicine.getStockQuantity()) {
                throw new IllegalArgumentException(String.format(
                        "Cannot set quantity to %d. Only %d units available in stock.",
                        req.quantity(), medicine.getStockQuantity()));
            }
            item.setQuantity(req.quantity());
            cartItemRepository.save(item);
        }

        return buildCartResponse(cartRepository.findById(cart.getId()).orElse(cart));
    }

    public CartResponse removeItem(UUID userId, UUID cartItemId) {
        PharmacyCart cart = getOrCreateCart(userId);
        PharmacyCartItem item = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new ResourceNotFoundException("Cart item", cartItemId));

        if (!item.getCart().getId().equals(cart.getId())) {
            throw new IllegalArgumentException("Cart item does not belong to user cart");
        }

        cart.getItems().remove(item);
        cartItemRepository.delete(item);

        return buildCartResponse(cartRepository.findById(cart.getId()).orElse(cart));
    }

    public CartResponse clearCart(UUID userId) {
        PharmacyCart cart = getOrCreateCart(userId);
        cart.getItems().clear();
        cartItemRepository.deleteByCartId(cart.getId());
        return buildCartResponse(cart);
    }

    public CartResponse buildCartResponse(PharmacyCart cart) {
        List<PharmacyCartItem> items = cart.getItems() != null ? cart.getItems() : List.of();
        List<CartItemResponse> itemDtos = items.stream().map(CartItemResponse::from).toList();

        int totalCount = 0;
        long subtotalPaise = 0L;
        long totalDiscountPaise = 0L;
        boolean hasRx = false;

        for (CartItemResponse dto : itemDtos) {
            totalCount += dto.quantity();
            subtotalPaise += dto.itemTotalPaise();
            if (dto.discountedPricePaise() != null && dto.pricePaise() > dto.discountedPricePaise()) {
                totalDiscountPaise += (dto.pricePaise() - dto.discountedPricePaise()) * dto.quantity();
            }
            if (dto.requiresPrescription()) {
                hasRx = true;
            }
        }

        long deliveryFeePaise = (subtotalPaise > 0 && subtotalPaise < FREE_DELIVERY_THRESHOLD_PAISE)
                ? STANDARD_DELIVERY_FEE_PAISE
                : 0L;

        long finalTotalPaise = subtotalPaise + deliveryFeePaise;

        return new CartResponse(
                cart.getId(),
                itemDtos,
                totalCount,
                subtotalPaise,
                totalDiscountPaise,
                deliveryFeePaise,
                finalTotalPaise,
                hasRx
        );
    }
}
