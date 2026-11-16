package com.group6.healthcare.pharmacy.dto;

import com.group6.healthcare.pharmacy.entity.PharmacyCommerceOrder;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record CommerceOrderResponse(
        UUID id,
        String orderNumber,
        UUID userId,
        List<CommerceOrderItemResponse> items,
        Long subtotalPaise,
        Long discountPaise,
        Long deliveryFeePaise,
        Long totalPaise,
        String orderStatus,
        String paymentStatus,
        String razorpayOrderId,
        String razorpayPaymentId,
        String deliveryName,
        String deliveryPhone,
        String deliveryStreet,
        String deliveryCity,
        String deliveryState,
        String deliveryPincode,
        UUID prescriptionId,
        String notes,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static CommerceOrderResponse from(PharmacyCommerceOrder order) {
        List<CommerceOrderItemResponse> itemDtos = order.getItems() != null
                ? order.getItems().stream().map(CommerceOrderItemResponse::from).toList()
                : List.of();

        return new CommerceOrderResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getUserId(),
                itemDtos,
                order.getSubtotalPaise(),
                order.getDiscountPaise(),
                order.getDeliveryFeePaise(),
                order.getTotalPaise(),
                order.getOrderStatus().name(),
                order.getPaymentStatus().name(),
                order.getRazorpayOrderId(),
                order.getRazorpayPaymentId(),
                order.getDeliveryName(),
                order.getDeliveryPhone(),
                order.getDeliveryStreet(),
                order.getDeliveryCity(),
                order.getDeliveryState(),
                order.getDeliveryPincode(),
                order.getPrescriptionId(),
                order.getNotes(),
                order.getCreatedAt(),
                order.getUpdatedAt()
        );
    }
}
